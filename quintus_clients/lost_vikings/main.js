
window.addEventListener("load", function(e) {


// initialize the Quintus Game Engine
var Q = window.Q = Quintus();

var debugLevel = 0;
//debugLevel |= Q._DEBUG_LOG_COLLISIONS; Q._DEBUG_LOG_COLLISIONS_AS = 0;//"Erik";
//debugLevel |= (Q._DEBUG_LOG_COLLISIONS | Q._DEBUG_CLEAR_CONSOLE); Q._DEBUG_LOG_COLLISIONS_AS = 0;//"Erik";
//debugLevel |= Q._DEBUG_LOG_ANIMATIONS;
//debugLevel |= (Q._DEBUG_RENDER_SPRITES_PINK | Q._DEBUG_RENDER_COLLISION_LAYER);
//debugLevel |= Q._DEBUG_RENDER_SPRITES_FILL;
//debugLevel |= Q._DEBUG_RENDER_OFTEN;
//debugLevel |= (Q._DEBUG_RENDER_OFTEN | Q._DEBUG_RENDER_OFTEN_AND_LOCATE);


Q.include("Sprites, Scenes, Input, 2D, AI, Touch, UI, Anim, Audio, Gyro")
	.setup({
		//width: Math.min(document.documentElement.clientWidth, 640),
		//height: Math.min(document.documentElement.clientHeight, 480),
		development: true,
		//maximize: "touch",
		//maxWidth: 300,
		//maxHeight: 200,
		debugLevel: debugLevel,
	}).enableSound();//.controls();

//Q.input.mouseControls();

var _TILE_SIZE = 16,
    _PLAYER_SIZE = 32;
    Q._EMPTY_OBJ = {}; // a read-only(!) empty object to reuse (to avoid excessive garbage collection)


// -------------------------------------
// GAME CONTROLS (components)
// -------------------------------------

// translates hardware input (keyboard, touchpad, etc..) into "brain-signals" (stored in entity.p.brainCommands)
// - these "brain-signals" can then be used by the entity's step method or the physics engine to control the character
Q.component("playerBrain", {
	added: function() {
		var entity = this.entity;
		// force 'brainCommands' property onto entity
		Q._defaults(entity.p,{
			brainCommands: { // commands going out to entity's step method to move the character
				left: false,
				right: false,
				up: false,
				down: false,
				action1: false,
				action2: false,
				},
		});
		this.controlTimers = {};// timer table to overwrite brainCommands for a certain amount of time
								// (e.g. player swiped up -> overwrite brainCommand.up for 1s to true)
								// controlTimers can be overwritten by animation flags and do not work on inactive characters
								// - holds the unix-time in ms when the signal should stop again (0 for off)
		for (var key in entity.p.brainCommands) this.controlTimers[key] = 0;

		entity.on("prestep", this, "step"); // run this component's step function before player's one
	},
	step: function(dt) {
		var entity = this.entity, p = entity.p;
		// copy state of Q.inputs into p.brainCommands if player is active
		if (p.isActiveCharacter) {
			var nocontrol = (p.animationFlags & Q.ANIM_DISABLES_CONTROL);
			for (var key in p.brainCommands) {
				this.controlTimers[key] -= dt;
				// if control is blocked by anim, still check for animation's keysStatus hash
				// - if animationKeysStatus[key]==1 -> switch on, 0=switch off, -1=use current state of Q.inputs
				// if control is not blocked -> use Q.inputs state
				p.brainCommands[key] = (
						nocontrol && p.animationKeysStatus[key] != -1 ?
							p.animationKeysStatus[key]
							:
							(
								// overwrite by a controlTimer (e.g. swipe?)
								this.controlTimers[key] > 0 ?
									true
									:
									(
										// check gyro and keyboard input
										(key == "left" && Q.gyroInput.alpha > 20) || (key == "right" && Q.gyroInput.alpha < -20) ?
											true
											:
											Q.inputs[key]
									)
							)
						);
				if (key == "action1") this.controlTimers[key] = 0;
			}
			return;
		}
		// player inactive: set everything to false
		for (var key in p.brainCommands) {
			p.brainCommands[key] = false;
			this.controlTimers[key] = 0;
		}
	},

	swiped: function(params/*=touch-obj, [up,down,left,right]*/) {
		var v = 0.75;
		if (this.controlTimers[params[1]] > 0)
			this.controlTimers[params[1]] += v;
		else
			this.controlTimers[params[1]] = v;
		// set all other control timers to 0 (for now)
		for (var key in this.controlTimers) {
			if (key != params[1]) this.controlTimers[key] = 0;
		}
	},

	tapped: function(touch) {
		if (this.controlTimers["action1"] <= 0) {
			for (var key in this.controlTimers) {
				if (key != "action1") this.controlTimers[key] = 0;
				else this.controlTimers["action1"] = 1; // 1s (will be reset to 0 by step method)
			}
		}
	},

});




// define our own 2d platform physics component
// - to be addable to any character (player or enemy)
Q.component("gamePhysics",{
	added: function() {
		var entity = this.entity;

		// force some new properties onto entity (if they don't exist yet)
		Q._defaults(entity.p,{
			// current state
			vx: 0,
			vy: 0,
			flip: false,

			// physics
			collisionMask: Q._SPRITE_DEFAULT | Q._SPRITE_LADDER | Q._SPRITE_PARTICLE,
			runAcceleration: 300, // running acceleration
			vxmax: 150, // max run-speed
			maxFallSpeed: 400, // maximum fall speed
			gravity: 1, // set to 0 to make this guy not be subject to y-gravity (e.g. while locked into ladder)
			jumpSpeed: 330, // jump-power
			disableJump: 0, // if 1: disable jumping so we don't keep jumping when action1 key keeps being pressed doen
			canJump: 1, // set to 0 to make this guy not be able to jump
			stopsAbruptlyOnDirectionChange: 1, // Vikings stop abruptly when running in one direction, then the other direction is pressed
			climbSpeed: 70, // speed at which player can climb
			isPushable: false, // set to true if a collision with the entity causes the entity to move a little
			isHeavy: false, // set to true if this object should squeeze other objects that are below it and cannot move away
			squeezeSpeed: 0, // set to a value > 0 to define the squeezeSpeed at which this object gets squeezed by heavy objects (objects with isHeavy == true)

			// environment stuff
			xmin: 0, // the minimum/maximum allowed positions
			ymin: 0,
			xmax: 9000,
			ymax: 9000,

			//touching: 0, // bitmap with those bits set that the entity is currently touching (colliding with)
			onGround: [0,0], // 0=current statel; 1=previous state (sometimes we need the previous state since the current state gets reset to 0 every step)
			atExit: false,
			atWall: false,
			onSlope: 0, // 1 if on up-slope, -1 if on down-slope
			onLadder: 0, // 0 if player is not locked into a ladder; y-pos of player, if player is currently locked into a ladder (in climbing position)
			whichLadder: 0, // holds the p property of the ladder Sprite, if player is currently touching a ladder sprite, otherwise: 0
			//climbFrameValue: 0, // parseInt([climbFrameValue]) determines the frame to use to display climbing position

			collisionOptions: {
				collisionMask: Q._SPRITE_LADDER,
				maxCol: 2,
				skipEvents: false,
				skipReciprocalEvents: true,
				},
		});
		var p = entity.p;
		p.xmin += p.cx; p.ymin += p.cy; p.xmax -= p.cx; p.ymax -= p.cy;

		entity.on("prestep", this, "step"); // run this component's step function before player's one
		entity.on("hit", this, "collision"); // handle collisions
	},

	// moves the entity by given x/y positions
	// if precheck is set to true: pre-checks the planned move via call to stage.locate and only moves entity as far as possible
	// - then returns the actual movement
	extend: {
		move: function(x, y, precheck) {
			var p = this.p;

			/*if (precheck) {
				var testcol = this.stage.locate(p.x+x, p.y+y, Q._SPRITE_DEFAULT, p.w, p.h);
				if ((!testcol) || (testcol.tileprops && testcol.tileprops['liquid'])) {
					return true;
				}
				return false;
			}*/

			p.x += x;
			p.y += y;
			// TODO: move the obj_to_follow into collide of stage (stage knows its borders best, then we don't need to define xmax/xmin, etc.. anymore)
			// maybe we could even build a default collision-frame around every stage when inserting the collision layer
			if (p.x < p.xmin) { p.x = p.xmin; p.vx = 0; }
			if (p.x > p.xmax) { p.x = p.xmax; p.vx = 0; }
			if (p.y < p.ymin) { p.y = p.ymin; p.vy = 0; }
			if (p.y > p.ymax) { p.y = p.ymax; p.vy = 0; }

			if (p.dockedObjects) {
				for (var id in p.dockedObjects) {
					if (p.dockedObjects[id].move) p.dockedObjects[id].move(x,y);
				}
			}
		},
	},

	// locks the player into the ladder
	lockLadder: function() {
		var p = this.entity.p;
		p.onLadder = p.y;
		p.gravity = 0;
		// move player to center of ladder
		p.x = p.whichLadder.x;
		p.vx = 0; // stop x-movement
	},
	// frees the player from ladder
	unlockLadder: function() {
		var p = this.entity.p;
		p.onLadder = 0;
		p.gravity = 1;
	},

	// a sprite lands on an elevator -> couple the elevator to the sprite so that when the elevator moves, the sprite moves along with it
	dockObject: function(dockableObject, motherShip) {
		if (motherShip.p.type && motherShip.p.type & Q._SPRITE_DEFAULT) {
			dockableObject.p.onGround[0] = motherShip;
			if (motherShip.p && motherShip.p.dockedObjects)
				motherShip.p.dockedObjects[dockableObject.p.id] = dockableObject;
		}
	},

	undockObject: function(dockableObject) {
		var motherShip = dockableObject.p.onGround[0];
		dockableObject.p.onGround[0] = 0;
		// remove docked obj from mothership docked-obj-list
		if (motherShip && motherShip.p && motherShip.p.dockedObjects) {
			Q._popProperty(motherShip.p.dockedObjects, dockableObject.p.id);
		}
	},

	// determines x/y-speeds and moves the player
	step: function(dt) {
		var entity = this.entity, p = entity.p, dtStep = dt, ax = 0, stage = entity.stage;

		//document.getElementById("debugtxt").innerHTML = p.name;

		// entity has a steering unit
		if (p.brainCommands) {
			// determine x speed
			// -----------------
			// user is trying to move left or right (or both?)
			if (p.brainCommands['left']) {
				// only left is pressed
				if (! p.brainCommands['right']) {
					if (p.stopsAbruptlyOnDirectionChange && p.vx > 0) p.vx = 0; // stop first if still walking in other direction
					ax = -(p.runAcceleration || 999000000000); // accelerate left
					p.flip = 'x'; // mirror sprite

					// user is pressing left or right -> leave onLadder state
					if (p.onLadder > 0) this.unlockLadder();
				}
				// user presses both keys (left and right) -> just stop
				else {
					p.vx = 0;
				}
			}
			// only right is pressed
			else if(p.brainCommands['right']) {
				if (p.stopsAbruptlyOnDirectionChange && p.vx < 0) p.vx = 0; // stop first if still walking in other direction
				ax = (p.runAcceleration || 999000000000); // accelerate right
				p.flip = false;

				// user is pressing left or right -> leave onLadder state
				if (p.onLadder > 0) this.unlockLadder();
			}
			// stop immediately (vx=0; don't accelerate negatively)
			else {
				//ax = 0; // already initalized to 0
				p.vx = 0;
			}

			// determine y speed
			// -----------------
			if (p.onLadder > 0) p.vy = 0;
			// user is pressing 'up' (ladder?)
			if(p.brainCommands['up']) {
				// player is currently on ladder
				if (p.onLadder > 0) {
					// reached the top of the ladder -> lock out of ladder
					if (p.y <= p.whichLadder.ytop - p.h/2)
						this.unlockLadder();
					else
						p.vy = -p.climbSpeed;
				}
				// player locks into ladder
				else if (p.whichLadder && p.y <= p.whichLadder.ybot - p.h/2 && p.y > p.whichLadder.ytop - p.h/2)
					this.lockLadder();
			}
			// user is pressing only 'down' (ladder?)
			else if (p.brainCommands['down']) {
				if (p.onLadder > 0) {
					// we reached the bottom of the ladder -> lock out of ladder
					if (p.y >= p.whichLadder.ybot - p.h/2)
						this.unlockLadder();
					else // move down
						p.vy = p.climbSpeed;
				}
				else if (p.whichLadder && p.y < p.whichLadder.ybot - p.h/2 && p.onGround[0])
					this.lockLadder();
			}
			// player jumps
			else if (p.canJump) {
				if (! Q.inputs['action1']) p.disableJump = 0;
				if (p.brainCommands['action1']) {
					if ((p.onLadder > 0 || p.onGround[0]) && (! p.disableJump)) {
						if (p.onLadder > 0) this.unlockLadder();
						p.vy = -p.jumpSpeed;
						this.undockObject(entity);
					}
					p.disableJump = 1;
				}
			}
		}
		// entity has no steering unit (x-speed = 0)
		else {
			p.vx = 0;
		}

		// TODO: check the entity's magnitude of vx and vy,
		// reduce the max dtStep if necessary to prevent 
		// skipping through objects.
		while(dtStep > 0) {
			dt = Math.min(1/30, dtStep);

			// update x/y-velocity based on acceleration
			p.vx += ax * dt + (p.gravityX == void 0 ? Q.gravityX : p.gravityX) * dt * p.gravity;
			if (Math.abs(p.vx) > p.vxmax) p.vx = (p.vx < 0 ? -p.vxmax : p.vxmax);
			p.vy += (p.gravityY == void 0 ? Q.gravityY : p.gravityY) * dt * p.gravity;

			// if player stands on up-slope and x-speed is negative (or down-slope and x-speed is positive)
			// -> make y-speed as high as x-speed so we don't fly off the slope
			if (p.onSlope != 0 && p.onGround[0]) {
				if (p.onSlope == 1 && p.vy < -p.vx) {
					p.vy = -p.vx;
				}
				else if (p.onSlope == -1 && p.vy < p.vx) {
					p.vy = p.vx;
				}
			}
			if (Math.abs(p.vy) > p.maxFallSpeed) p.vy = (p.vy < 0 ? -p.maxFallSpeed : p.maxFallSpeed);

			// update x/y-positions before checking for collisions at these new positions
			entity.move(p.vx * dt, p.vy * dt);

			// log movements and collisions?
			if (Q.debug & Q._DEBUG_LOG_COLLISIONS && ((!Q._DEBUG_LOG_COLLISIONS_AS) || Q._DEBUG_LOG_COLLISIONS_AS == p.name))
				console.log("check cols for "+p.name+": x="+p.x+" y="+p.y+" vx="+p.vx+" vy="+p.vy);
			// render sprites often?
			if (Q.debug & Q._DEBUG_RENDER_OFTEN)
				renderAllForDebug(Q, this.entity);

			// reset all touch flags before doing all the collision analysis
			p.onSlope = 0;
			if (p.onLadder == 0) p.whichLadder = 0;
			p.atWall = 0;
			p.atExit = 0;
			p.onGround[1] = p.onGround[0]; // store "old" value before undocking
			this.undockObject(entity);

			// check for collisions on this entity's stage AND return in options-hash whether we have a ladder collision amongst the set of collisions
			var opts = p.collisionOptions;
			// check for collisions with ladders first (before collision layer!)
			opts.collisionMask = Q._SPRITE_LADDER;
			stage.collide(entity, opts);
			// then check for collisions layer, enemies and everything else
			opts.collisionMask = (p.collisionMask ^ Q._SPRITE_LADDER);
			stage.collide(entity, opts);

			if (Q.debug & Q._DEBUG_LOG_COLLISIONS && ((!Q._DEBUG_LOG_COLLISIONS_AS) || Q._DEBUG_LOG_COLLISIONS_AS == p.name))
				console.log("checked cols");

			// render sprites often?
			if (Q.debug & Q._DEBUG_RENDER_OFTEN) renderAllForDebug(Q, this.entity);

			dtStep -= dt;
		}
	},

	collision: function(col, last) {
		var entity = this.entity, p = entity.p;

		//console.log("collision id="+col.obj.p.id+" normal="+col.normalX+"/"+col.normalY+" sep="+col.separate[0]+"/"+col.separate[1]+" veloc="+p.vx+"/"+p.vy+" pos="+p.x+"/"+p.y);
		console.assert(col.obj, "no collision obj (col.obj)!");
		console.assert(col.obj.p, "no properties (p) within collision obj (col.obj.p)!");

		var objp = col.obj.p;

		if (Q.debug & Q._DEBUG_LOG_COLLISIONS && ((!Q._DEBUG_LOG_COLLISIONS_AS) || Q._DEBUG_LOG_COLLISIONS_AS == p.name))
			console.log("\tcol ("+p.name+" hit "+objp.name+"): onSlope="+p.onSlope+" x="+p.x+" y="+p.y+" vx="+p.vx+" vy="+p.vy);

		// getting hit by a particle
		// - arrow, scorpionshot, fireball, etc..
		if (objp.type & Q._SPRITE_PARTICLE) {
			// shooter (this) is colliding with own shot -> ignore
			if (entity !== objp.shooter) {
				entity.trigger("hitParticle", col);
				col.obj.trigger("hit", entity); // for particles, force the reciprocal collisions (otherwise, the character that got shot could be gone (dead) before any collisions on the particle could get triggered (-> e.g. arrow will fly through a dying enemy without ever actually touching the enemy))
			}
			if (Q.debug & Q._DEBUG_LOG_COLLISIONS && ((!Q._DEBUG_LOG_COLLISIONS_AS) || Q._DEBUG_LOG_COLLISIONS_AS == p.name))
				console.log("\t\tparticle: x="+p.x+" y="+p.y+" vx="+p.vx+" vy="+p.vy);
			return;
		}
		// colliding with a ladder
		if (objp.type & Q._SPRITE_LADDER) {
			// set whichLadder to the ladder's props
			p.whichLadder = objp;
			// if we are not locked into ladder AND on very top of the ladder, collide normally (don't fall through ladder's top)
			if (p.onLadder > 0 || col.normalX != 0 /* don't x-collide with ladder */ || col.normalY > 0 /* don't collide with bottom of ladder*/)
				return;
		}

		// ----------------------------
		// collision layer:
		// ----------------------------
		var tileprops = (col.tileprops || Q._EMPTY_OBJ);
		// quicksand or water
		if (tileprops["liquid"]) {
			entity.trigger("hitLiquidGround", tileprops["liquid"]);
			if (Q.debug & Q._DEBUG_LOG_COLLISIONS && ((!Q._DEBUG_LOG_COLLISIONS_AS) || Q._DEBUG_LOG_COLLISIONS_AS == p.name))
				console.log("\t\tliquid ground: x="+p.x+" y="+p.y+" vx="+p.vx+" vy="+p.vy);
			return;
		}
		// colliding with an exit
		else if (tileprops["exit"]) {
			p.atExit = true;
			entity.stage.options.levelObj.trigger("reachedExit", entity); // let the level know
			if (Q.debug & Q._DEBUG_LOG_COLLISIONS && ((!Q._DEBUG_LOG_COLLISIONS_AS) || Q._DEBUG_LOG_COLLISIONS_AS == p.name))
				console.log("\t\texit: x="+p.x+" y="+p.y+" vx="+p.vx+" vy="+p.vy);
			return;
		}
		// check for slopes
		else if (col.slope && p.onGround[1]) {
			var absslope = Math.abs(col.slope);
			var offset = parseInt(tileprops["offset"]);
			// set p.y according to position of sprite within slope square
			var ytile = (col.tileY+1) * col.obj.p.tileH; // bottom y-pos of tile
			// subtract from bottom-y for different inclines and different stages within the incline
			var dy_wanted = (ytile - (col.obj.p.tileH*(offset-1)/absslope) - p.cy - (col.xin / absslope)) - p.y;
			//p.y = ytile - (col.obj.p.tileH*(offset-1)/absslope) - p.cy - (col.xin / absslope);
			// can we move there?
			//var dy_actual = 
			entity.move(0, dy_wanted, true);//TODO: check top whether we can move there (there could be a block)!!)) {
			//if (dy_actual < dy_wanted) {
				// if not -> move back in x-direction
				//TODO: calc xmoveback value
			//}
			p.vy = 0;
			this.dockObject(entity, col.obj); // dock to collision layer
			p.onSlope = col.sl;

			if (Q.debug & Q._DEBUG_LOG_COLLISIONS && ((!Q._DEBUG_LOG_COLLISIONS_AS) || Q._DEBUG_LOG_COLLISIONS_AS == p.name))
				console.log("\t\tslope: x="+p.x+" y="+p.y+" vx="+p.vx+" vy="+p.vy);
			return;
		}

		// normal collision
		col.impact = 0;

		var impactX = Math.abs(p.vx);
		var impactY = Math.abs(p.vy);

		// move away from the collision (back to where we were before)
		var xorig = p.x, yorig = p.y;
		p.x -= col.separate[0];
		p.y -= col.separate[1];

		// bottom collision
		if(col.normalY < -0.3) { 
			// a heavy object hit the ground -> rock the stage
			if (p.isHeavy && (!p.onGround[1]) /*1=check old value, the new one was reset to 0 before calling 'collide'*/
				&& objp.type & Q._SPRITE_DEFAULT)
			{
				entity.stage.shake();
			}

			// squeezing something
			if (p.isHeavy && objp.squeezeSpeed > 0 && objp.onGround[0] && p.vy > 0) {
				// adjust the collision separation to the new squeezeSpeed
				if (p.vy > objp.squeezeSpeed) {
					p.y = yorig + col.separate[1]*(objp.squeezeSpeed / p.vy);
				}
				else p.y += col.separate[1]; // otherwise, just undo the separation

				p.vy = objp.squeezeSpeed;
				col.obj.trigger("squeezed.top", p);
			}
			// normal bottom collision
			else {
				if (p.vy > 0) p.vy = 0;
				col.impact = impactY;
				this.dockObject(entity, col.obj); // dock to bottom object (collision layer or MovableRock, etc..)
				entity.trigger("bump.bottom",col);
			}
		}

		// top collision
		if(col.normalY > 0.3) {
			if (p.vy < 0) { p.vy = 0; }
			col.impact = impactY;
			//OBSOLETE (since points of squeezee get updated when squeezed.top triggered)????
			// getting squeezed? -> undo the separation (and adjust the collision points)
			//if (objp.isHeavy && p.squeezeSpeed > 0 && p.on_ground[1]) {
			//	p.y += col.separate[1];
			//}
			//else
				entity.trigger("bump.top",col);
		}

		// left/right collisions
		if(Math.abs(col.normalX) > 0.3) { 
			col.impact = impactX;
			var bump_wall = 0;
			// we hit a pushable object -> check if it can move
			if (objp.isPushable && p.onGround[1] /*1=check old value, new one has been set to 0 before calling 'collide'*/) {
				this.pushAnObject(entity, col);
				bump_wall = 1;
			}
			// we hit a fixed wall (non-pushable)
			else if (p.vx * col.normalX < 0) { // if normalX < 0 -> p.vx is > 0 -> set to 0; if normalX > 0 -> p.vx is < 0 -> set to 0
				p.vx = 0;
				bump_wall = 1;
			}

			if (bump_wall) {
				if (objp.type & Q._SPRITE_DEFAULT) p.atWall = true;
				entity.trigger("bump."+(col.normalX < 0 ? "right" : "left"), col);
			}
		}

		if (Q.debug & Q._DEBUG_LOG_COLLISIONS && ((!Q._DEBUG_LOG_COLLISIONS_AS) || Q._DEBUG_LOG_COLLISIONS_AS == p.name))
			console.log("\t\tnormal col: x="+p.x+" y="+p.y+" vx="+p.vx+" vy="+p.vy);
	},

	pushAnObject: function(pusher, col) {
		var p = pusher.p, pushee = col.obj, pushee_p = pushee.p;
		//TODO: what if normalX is 1/-1 BUT: impactX is 0 (yes, this can happen!!)
		// for now: don't push, then
		if (col.impact > 0) {
			var movex = col.separate[0] * Math.abs(pushee_p.vxmax / col.impact);
			//console.log("pushing Object: movex="+movex);
			// do a locate on the other side of the - already moved - pushable object
			//var testcol = pusher.stage.locate(pushee_p.x+movex+(pushee_p.cx+1)*(p.flip == 'x' ? -1 : 1), pushee_p.y, (Q._SPRITE_DEFAULT | Q._SPRITE_FRIENDLY | Q._SPRITE_ENEMY));
			//if (testcol && (! (testcol.tileprops && testcol.tileprops.slope))) {
			//	p.vx = 0; // don't move player, don't move pushable object
			//}
			//else {
				// move obj (plus all its docked objects) and move pusher along
				pusher.move(movex, 0);
				//p.x += movex;
				pushee.move(movex, 0);
				//pushee_p.x += movex;
				//if (pushee_p.dockedObjects) {
				//	for (var id in pushee_p.dockedObjects) {
				//		pushee_p.dockedObjects[id].p.x += movex;
				//	}
				//}
				p.vx = pushee_p.vxmax * (p.flip == 'x' ? -1 : 1);
			//}
		}
		else {
			p.vx = 0;
		}
	},

});


// -------------------------------------
// A GENERIC VIKING
// -------------------------------------
Q.Sprite.extend("Viking",{
	init: function(p, defaults) {
		Q._defaults(defaults,
			// default behavior for Sprite
			{
				frame: 0,
				x: 50, // default start position
				y: 50,
				type: Q._SPRITE_FRIENDLY,

				//characterID: 0,
				isActiveCharacter: false, // is this character the active one (=being controlled through keys)?
				squeezeSpeed: 0.5,
				lifePoints: 3,
				standingAroundSince: 0,
				ladderFrame: 0,
				unhealthyFallSpeed: 340, // the fall speed at which we bump our head on the floor
				//TODO: unhealthyFallSpeedOnSlopes: 340, // on slopes, the vikings can fall a little harder without hurting themselves
			}
		);
		this._super(p, defaults);

		// add components to this player
		this.add("playerBrain").add("gamePhysics").add("animation");

		// listen for some events
		this.on("bump.bottom", this, "land");
		this.on("squeezed.top", this, "getSqueezed");
		this.on("hitLiquidGround"); // player stepped into liquid ground
		this.on("hitParticle"); // player hits a particle
		this.on("die"); // some animations trigger 'die' when done

		// initialize the 'getting bored'-timer
		this.p.nextBoredSeq = parseInt(Math.random() * 10)+5; // play the next 'bored'-sequence after this amount of seconds
	},

	// makes this player active
	activate: function() {
		if (!this.p.isActiveCharacter) {
			this.p.isActiveCharacter = true;
			// activate active Player controls
			Q.touchInput.on("swipe", this.playerBrain, "swiped");
			Q.touchInput.on("tap", this.playerBrain, "tapped");
		}
		return this;
	},

	// makes this player inactive
	deactivate: function() {
		if (this.p.isActiveCharacter) {
			this.p.isActiveCharacter = false;
			// deactivate Player controls
			Q.touchInput.off("swipe", this.playerBrain);
			Q.touchInput.off("tap", this.playerBrain);
		}
		return this;
	},

	// Controls component's "step"-method gets called first (event: entity.prestep fired by Player's "update"-method), only then the Player's step method is called
	// mainly determines player's animation that gets played
	step: function(dt) {
		var p = this.p;
		var anim = p.animation;

		// player is currently standing on ladder (locked into ladder)
		if (p.onLadder > 0) {
			p.animation = false; // do anim manually when on ladder
			p.animationFlags = 0;

			var characterBot = p.y + p.cy - 4;

			// we are alomst at the top -> put end-of-ladder frame
			if (characterBot <= p.whichLadder.ytop) {
				p.ladderFrame = 63;
				// we crossed the "frame-jump" barrier -> y-jump player to cover the sprite frame y-shift between ladder top position and ladder 2nd-to-top position
				if (p.onLadder > p.whichLadder.ytop) p.y -= 5;
			}
			// we are reaching the top -> put one-before-end-of-ladder frame
			else if (characterBot <= p.whichLadder.yalmosttop) {
				p.ladderFrame = 64;
				if (p.onLadder <= p.whichLadder.ytop) p.y += 5;
			}
			// we are in middle of ladder -> alternate climbing frames
			else {
				p.ladderFrame += p.vy * dt * -0.16;
				if (p.ladderFrame >= 69) p.ladderFrame = 65;
				else if (p.ladderFrame < 65) p.ladderFrame = 68.999;
			}

			p.onLadder = p.y + p.cy - 4; // update onLadder (serves as y-pos memory for previous y-position so we can detect a crossing of the "frame-jump"-barrier)
			p.frame = parseInt(p.ladderFrame); // normalize to while frame number
		}
		// jumping/falling
		else if (this.checkInAir()) {
		}
		// hit with sword
		else if(this.checkHitWithSword && this.checkHitWithSword()) {
		}
		// shoot arrow
		else if(this.checkShootWithArrow && this.checkShootWithArrow()) {
		}
		// moving in x direction
		else if (p.vx != 0) {
			this.checkRunning();
		}
		// not moving in x direction
		else {
			if (anim == 'stand') p.standingAroundSince += dt;
			else p.standingAroundSince = 0;

			// not moving in x-direction, but trying -> push
			if ((p.brainCommands['left']) != (p.brainCommands['right'])) { // xor
				if (anim != 'push') this.play("push");
			}
			// out of breath from running?
			else if (this.checkOutOfBreath && this.checkOutOfBreath()) {
			}
			// getting bored?
			else if (this.checkBoredTimer()) {
			}
			// just stand
			else if (this.allowPlayStand()) {
				this.play("stand");
			}
		}
	},

	// function is called when sprite lands on floor
	land: function(col) {
		// if impact was big -> bump head/beDizzy
		if (col.impact > this.p.unhealthyFallSpeed) {
			this.play("beDizzy", 1);
		}
	},

	// quicksand or water
	hitLiquidGround: function(what) {
		var p = this.p, anim = p.animation;
		if (what == 'quicksand') {
			if (anim != 'sinkInQuicksand') this.play("sinkInQuicksand", 1);
		}
		else if (what == 'water') {
			if (anim != 'sinkInWater') this.play("sinkInWater", 1);
		}
		p.vy = 2;
	},

	// hit a flying particle (shot, arrow, etc..)
	hitParticle: function(col) {
		var p = this.p;
		// sliding away from arrow
		//TODO: if we set the speed here, it will be overwritten (to 0) by step func in gamePhysics component
		// we need to have something like an external force that will be applied on top of the player's/scorpion's own movements
		//p.vx = 100*(col.normalX > 0 ? 1 : -1);
		//p.gravityX = -2*(col.normalX > 0 ? 1 : -1);
		this.play("getHurt", 1);
	},

	// called when this object gets squeezed from top by a heavy object
	getSqueezed: function(squeezerp) {
		var p = this.p, anim = p.animation;
		if (anim != "getSqueezed") this.play("getSqueezed", 1);
		// update collision points (top point should be 1px lower than bottom point of squeezer)
		var dy = (squeezerp.y + squeezerp.cy) - (p.y + p.points[0][1]) + 1;
		Q._changePoints(this, 0, dy);
	},

	// die function (take this Viking out of the game)
	die: function() {
		this.trigger("dead", this);
		this.destroy();
	},

	// function stubs (may be implemented if these actions are supported)

	// player is running (called if x-speed != 0)
	checkRunning: function() {
		var p = this.p, anim = p.animation;
		if ((p.brainCommands['left']) != (p.brainCommands['right'])) { // xor
			if (p.atWall) {
				if (anim != 'push') this.play("push");
			}
			else if (anim != 'run')
				this.play("run");
			
		}
	},
	// check whether we are in the air
	checkInAir: function() {
		var p = this.p, anim = p.animation;
		// we are sinking in water/quicksand
		if (anim == 'sinkInQuicksand' || anim == 'sinkInWater') {
			return false;
		}
		// falling too fast
		else if (p.vy > p.unhealthyFallSpeed) {
			if (anim != 'fall') this.play("fall");
			return true;
		}
		else if (p.vy != 0) {
			if (anim != 'jump') this.play("jump");
			return true;
		}
		return false;
	},
	// check, whether player is getting bored (to play bored sequence)
	checkBoredTimer: function() {
		var p = this.p;
		if (p.standingAroundSince > p.nextBoredSeq) {
			p.standingAroundSince = 0;
			p.nextBoredSeq = parseInt(Math.random() * 10)+5;
			this.play("beBored"+(Math.random() >= 0.5 ? "1" : "2"));
			return true;
		}
		return false;
	},
	// check, whether it's ok to play 'stand' animation
	allowPlayStand: function() {
		return (! (this.p.animationFlags & Q.ANIM_PROHIBITS_STAND));
	},

});

// define player: Baleog
Q.Viking.extend("Baleog",{
	init: function(p) {
		Q.animations("baleog", {
			stand: { frames: [0], loop: false, flags: Q.ANIM_PROHIBITS_STAND },
			beBored1: { frames: [1,2,2,1,1,3,4,3,4,5,6,5,6,7,8,7,8,3,4,3,4], rate: 1/3, loop: false, next: 'stand', flags: Q.ANIM_PROHIBITS_STAND },
			beBored2: { frames: [1,2,2,1,1,7,8,7,8,2,2,1,2,2,1], rate: 1/3, loop: false, next: 'stand', flags: Q.ANIM_PROHIBITS_STAND },

			run: { frames: [9,10,11,12,13,14,15,16], rate: 1/8 },
			push: { frames: [54,55,56,57], rate: 1/4 },

			jump: { frames: [36, 37], rate: 1/6 },
			fall: { frames: [38], loop: false, flags: Q.ANIM_DISABLES_CONTROL, keysStatus: {left: -1, right: -1, up: -1} },
			beDizzy: { frames: [39,40,41,40,41,42,42,43], rate: 1/3, loop: false, next: 'stand', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_PROHIBITS_STAND) },
			getHurt: { frames: [72], rate: 1/2, next: 'stand', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_PROHIBITS_STAND) },
			getSqueezed: { frames: [122, 123, 124, 124, 125, 125, 125, 125], rate: 1/3, loop: false, trigger: 'die', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_PROHIBITS_STAND) },
			sinkInQuicksand: { frames: [120, 121, 121, 120, 120, 121, 121, 120], rate: 1/2, loop: false, trigger: 'die', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_PROHIBITS_STAND) },
			sinkInWater: { frames: [90,91,92,93,91,92,93], rate: 1/2, loop: false, trigger: 'die', flags: (Q.ANIM_PROHIBITS_STAND | Q.ANIM_DISABLES_CONTROL) },
			burn: { frames: [126, 127, 128, 129, 130, 131, 132, 133], rate: 1/4, loop: false, trigger: 'die', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_PROHIBITS_STAND) },

			swingSword1: { frames: [18,19,20,21], rate: 1/4, loop: false, next: 'stand', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_SWING_SWORD), keysStatus: {action1: 1} }, // disables control, except for action1 (which is pressed down)
			swingSword2: { frames: [22,23,24,25], rate: 1/4, loop: false, next: 'stand', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_SWING_SWORD), keysStatus: {action1: 1} }, // disables control, except for action1 (which is pressed down)

			drawBow: { frames: [27,27,28,29,30,31], rate: 1/5, loop: false, next: 'holdBow', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_BOW), keysStatus: {action2: 1} },
			holdBow: { frames: [31], loop: false, flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_BOW), keysStatus: {action2: -1} },
			releaseBow: { frames: [33,32,33,32,33,32,0], rate: 1/6, loop: false, next: 'stand', flags: (Q.ANIM_PROHIBITS_STAND | Q.ANIM_BOW) },
		});

		this._super(p,
			// default behavior for Viking
			{
				sprite: "baleog", // links this Sprite with the animation definition: baleog
				sheet: "baleog",
				canJump: 0, // Baleog cannot jump
			}
		);

		Q._defaults(this.p, {
			disableSword: 0, // if 1, cannot perform sword (action1)
			});
	},

	// hit with sword
	// - returns true if player is currently hitting with sword
	checkHitWithSword: function() {
		var p = this.p, animFlags = p.animationFlags;
		// action1 is pressed AND user's sword is replenished (had released action1 key) AND anim is currently not swinging sword
		if(p.brainCommands['action1'] && (! p.disableSword) && (! (animFlags & Q.ANIM_SWING_SWORD))) {
			p.disableSword = 1;
			this.play("swingSword"+(Math.random() >= 0.5 ? "1" : "2"));
			return true;
		}
		// reenable sword? (space key needs to be released between two sword strikes)
		else if (! Q.inputs['action1']) // TODO: what about touch screens?
			p.disableSword = 0;

		return (animFlags & Q.ANIM_SWING_SWORD);
	},

	// shoot arrow
	// - returns true if player is doing something with arrow right now
	// - false otherwise
	checkShootWithArrow: function() {
		var p = this.p, anim = p.animation, animFlags = p.animationFlags;
		if(p.brainCommands['action2'] && (! (animFlags & Q.ANIM_BOW))) {
			this.play("drawBow");
			return true;
		}
		else if ((! p.brainCommands['action2']) && anim == 'holdBow') {
			this.play("releaseBow");
			this.stage.insert(new Q.Arrow({shooter: this}));
			return true;
		}
		return (p.brainCommands['action2'] && animFlags & Q.ANIM_BOW);
	},

});

// define player: Erik the Swift
Q.Viking.extend("Erik",{
	init: function(p) {
		Q.animations("erik", {
			stand: { frames: [0], loop: false, flags: Q.ANIM_PROHIBITS_STAND},
			beBored1: { frames: [1], rate: 1/2, next: 'stand', flags: Q.ANIM_PROHIBITS_STAND },
			beBored2: { frames: [61,2,3,4,3,4,3,4], rate: 1/3, next: 'stand', flags: Q.ANIM_PROHIBITS_STAND },

			run: { frames: [5,6,7,8,9,10,11,12], rate: 1/8 },
			outOfBreath: { frames: [13,14,15,13,14,15], rate: 1/4, next: 'stand', flags: Q.ANIM_PROHIBITS_STAND },
			push: { frames: [54,55,56,57], rate: 1/4 },

			jumpUp: { frames: [16], loop: false },
			jumpPeak: { frames: [17], loop: false },
			jumpDown: { frames: [18,19], rate: 1/3 },
			fall: { frames: [81], loop: false, flags: Q.ANIM_DISABLES_CONTROL, keysStatus: {left: -1, right: -1, up: -1} },
			beDizzy: { frames: [36,37,38,39,40,38,39,40,41,42,43], rate: 1/3, loop: false, next: 'stand', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_PROHIBITS_STAND) },
			getHurt: { frames: [72], rate: 1/2, next: 'stand', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_PROHIBITS_STAND) },
			getSqueezed: { frames: [126, 127, 128, 128, 129, 129, 129, 129], rate: 1/4, loop: false, trigger: 'die', flags: (Q.ANIM_DISABLES_CONTROL | Q.ANIM_PROHIBITS_STAND) },
			sinkInQuicksand: { frames: [108, 109, 110, 108, 109, 110, 108, 109], loop: false, rate: 1/2, trigger: 'die', flags: (Q.ANIM_PROHIBITS_STAND | Q.ANIM_DISABLES_CONTROL) },
			sinkInWater: { frames: [90,91,92,93,91,92,93], loop: false, rate: 1/2, trigger: 'die', flags: (Q.ANIM_PROHIBITS_STAND | Q.ANIM_DISABLES_CONTROL) },
			burn: { frames: [117, 118, 119, 120, 121, 122, 123, 124], rate: 1/4, loop: false, trigger: 'die', flags: Q.ANIM_DISABLES_CONTROL },
		});

		this._super(p,
			// default behavior for Viking
			{
				sprite: "erik", // links this Sprite with the animation definition: erik
				sheet: "erik",
				runAcceleration: 450, // Erik is a little faster
				vxmax: 175, // see above
				stopsAbruptlyOnDirectionChange: 0, // usually Vikings stop when running in one direction, then running in the other one, Erik doesn't
				canJump: 1,
			}
		);

		Q._defaults(this.p, {
			ranFast: 0, // flag: if 1, play outOfBreath sequence
			vxOutOfBreath: 120, // speed after which to play outOfBreath sequence
			vxSmashWall: 150, // minimum speed at which we can initiate smash sequence with 'D'
			});
	},

	checkRunning: function(){
		var p = this.p, anim = p.animation;
		if ((p.brainCommands['left']) != (p.brainCommands['right'])) { // xor
			if (p.atWall) {
				if (anim != 'push') this.play("push");
				p.ranFast = 1;
			}
			else if (anim != 'run') this.play("run");
			if (Math.abs(p.vx) > p.vxOutOfBreath) p.ranFast = 1;
		}
	},

	// check whether we are in the air
	checkInAir: function() {
		var p = this.p, anim = p.animation;
		// we are sinking in water/quicksand
		if (anim == 'sinkInQuicksand' || anim == 'sinkInWater') {
			return false;
		}
		// falling too fast
		else if (p.vy > p.unhealthyFallSpeed) {
			if (anim != 'fall') this.play("fall");
			return true;
		}
		// Erik jumps
		else if (p.vy != 0) {
			if (Math.abs(p.vy) < 60) {
				if (anim != 'jumpPeak') this.play("jumpPeak");
			}
			else if (p.vy < 0) {
				if (anim != 'jumpUp') this.play("jumpUp");
			}
			else if (p.vy > 0) {
				if (anim != 'jumpDown') this.play("jumpDown");
			}
			return true;
		}
		return false;
	},

	// overwrite bored functionality: Erik blinks eyes more often than he does his other crazy stuff
	checkBoredTimer: function() {
		var p = this.p;
		if (p.standingAroundSince > p.nextBoredSeq) {
			p.standingAroundSince = 0;
			p.nextBoredSeq = parseInt(Math.random() * 5)+5;
			this.play("beBored"+(Math.random() >= 0.2 ? "1" : "2"));
			return true;
		}
		return false;
	},

	// check whether we should play the out of breath sequence
	checkOutOfBreath: function() {
		var p = this.p, anim = p.animation;
		if (anim == 'run' && p.ranFast) {
			this.play("outOfBreath");
			p.ranFast = 0;
		}
		return false;
	},
});


// -------------------------------------
// A SCORPION
// -------------------------------------
Q.Sprite.extend("Scorpion",{
	init: function(p) {
		// define an animation scheme
		Q.animations("scorpion", {
			stand: { frames: [0], loop: false, flags: Q.ANIM_PROHIBITS_STAND },
			getHurt: { frames: [0], rate: 1/3, loop: false, next: 'stand', flags: Q.ANIM_DISABLES_CONTROL },
			run: { frames: [0,1,2,1], rate: 1/4 },
			shoot: { frames: [4], next: 'stand', rate: 1/2, flags: (Q.ANIM_PROHIBITS_STAND | Q.ANIM_DISABLES_CONTROL) },
		});

		Q._defaults(p,
			// default behavior for Sprite
			{
				sprite: "scorpion", // links this Sprite with the animation definition
				sheet: "scorpion",
				frame: 0,
				x: 350, // default start position
				y: 50,
				type: Q._SPRITE_ENEMY,
				vxmax: 50,
				isMadSince: 0, // when mad, moves with twice the speed
				runAcceleration: 0, // don't accelerate (always move at max-speed)
			}
		);
		this._super(p);
		this.add("aiBrain").add("gamePhysics").add("animation");
		this.on("hitParticle");
	},

	step: function(dt) {
		var p = this.p;
		var anim = p.animation;

		if (p.isMadSince > 0) {
			p.isMadSince += dt;
			if (p.isMadSince > 5) {
				this.calmDown();
			}
		}

		// shooting?
		if (p.brainCommands['shoot']) {
			this.play("shoot");
			this.stage.insert(new Q.Shot({name: "Scorpion Shot", shooter: this, vx: 80, vy: -100, ay: 140}));
		}
		// moving in x direction
		else if (p.vx != 0) {
			this.checkRunning();
		}
		// not moving in x direction
		// -> check whether we are allowed to play 'stand'
		else if (! (p.animationFlags & Q.ANIM_PROHIBITS_STAND)) {
			this.play("stand");
		}
	},

	// is running (called if x-speed != 0)
	checkRunning: function() {
		var p = this.p, anim = p.animation;
		if ((p.brainCommands['left']) != (p.brainCommands['right']) && anim != 'run') { // xor
			this.play("run");
		}
	},

	// hit a flying particle (shot, arrow, etc..)
	hitParticle: function(col) {
		var p = this.p;
		// sliding away from particle
		p.vx = 100*(col.normalX > 0 ? 1 : -1);
		//p.ax = -2*(col.normalX > 0 ? 1 : -1);
		this.play("getHurt", 1);
		this.getMad();
	},

	getMad: function() {
		var p = this.p;
		p.isMadSince = 0.0000001;
		p.vxmax *= 2;
	},
	calmDown: function() {
		var p = this.p;
		p.isMadSince = 0;
		p.vxmax /= 2;
	},
});


// -------------------------------------
// A DINOSAUR
// -------------------------------------
Q.Sprite.extend("Dinosaur",{
	init: function(p) {
		// define an animation scheme
		Q.animations("dinosaur", {
			stand: { frames: [4], loop: false, flags: Q.ANIM_PROHIBITS_STAND },
			getHurt: { frames: [9,10], rate: 1/2, loop: false, next: 'stand', flags: Q.ANIM_DISABLES_CONTROL },
			run: { frames: [0,1,2,3], rate: 1/4 },
			bite: { frames: [4,5,6,7,8], next: 'stand', rate: 1/4, flags: (Q.ANIM_PROHIBITS_STAND | Q.ANIM_DISABLES_CONTROL) },
			die: { frames: [], rate: 1/4, trigger: "die", flags: (Q.ANIM_PROHIBITS_STAND | Q.ANIM_DISABLES_CONTROL) },
		});

		Q._defaults(p,
			// default behavior for Sprite
			{
				sprite: "dinosaur", // links this Sprite with the animation definition
				sheet: "enemies",
				frame: 0,
				x: 350, // default start position
				y: 50,
				type: Q._SPRITE_ENEMY,
				vxmax: 50,
				lifeEnergy: 3, // when 0 -> die
				isMadSince: 0, // when mad, moves with twice the speed
				runAcceleration: 0, // don't accelerate (always move at max-speed)
			}
		);
		this._super(p);
		this.add("aiBrain").add("gamePhysics").add("animation");
		this.on("hitParticle");
	},

	step: function(dt) {
		var p = this.p;
		var anim = p.animation;

		// shooting?
		if (p.brainCommands['bite']) {
			this.play("bite");
		}
		// moving in x direction
		else if (p.vx != 0) {
			this.checkRunning();
		}
		// not moving in x direction
		// -> check whether we are allowed to play 'stand'
		else if (! (p.animationFlags & Q.ANIM_PROHIBITS_STAND)) {
			this.play("stand");
		}
	},

	// is running (called if x-speed != 0)
	checkRunning: function() {
		var p = this.p, anim = p.animation;
		if ((p.brainCommands['left']) != (p.brainCommands['right']) && anim != 'run') { // xor
			this.play("run");
		}
	},

	// hit a flying particle (shot, arrow, etc..)
	hitParticle: function(col) {
		var p = this.p;
		// sliding away from particle
		//p.vx = 100*(col.normalX > 0 ? 1 : -1);
		//p.ax = -2*(col.normalX > 0 ? 1 : -1);
		//TODO: implement a push in the physicsEngine
		if (col.obj.p.type & Q._SPRITE_ARROW && col.obj.p.hitSomething == false) {
			p.lifeEnergy -= col.obj.p.damage;
			if (p.lifeEnergy <= 0) {
				this.die();
				return;
			}
			this.play("getHurt", 1);
		}
	},

	die: function() {
		this.trigger("dead", this);
		this.play("die");
		this.destroy();
	},
});




// -------------------------------------
// A SHOT (like the one a scorpion shoots)
// - can be extended to do more complicated stuff
// -------------------------------------

Q.Sprite.extend("Shot",{
	init: function(p) {
		console.assert(p.shooter, "No shooter property given in 'Shot' c'tor!"); // make sure we got a shooter object

		// set some defaults
		Q._defaults(p, {
			xoffset: 0,
			yoffset: 0,
			animname: "scorpionshot",
			animscheme: {
					fly: { frames: [0], rate: 1, loop: false },
					hit: { frames: [1], rate: 3/2, loop: false, trigger: 'collisionDone' },
				},
			ax: 0, // the air resistance in x-direction
			ay: 0, // the gravity + air resistance in y-direction
			vx: 300, // the initial x-speed
			vy: 0,
			damage: 1, // the damage that the shot causes
			hitSomething: false, // flag to make sure a collision doesn't cause more than 1 action
			collisionMask: Q._SPRITE_DEFAULT | Q._SPRITE_FRIENDLY,
		});
		Q.animations(p.animname, p.animscheme);

		// flip particle depending on player's flip
		var flip = p.shooter.p.flip;
		p.vx = (flip == 'x' ? -p.vx : p.vx);
		p.x = p.shooter.p.x + p.xoffset * (flip == 'x' ? -1 : 1);
		p.y = p.shooter.p.y + p.yoffset;

		this._super(p,
			// default behavior for Sprite
			{
				sprite: p.animname,
				sheet: p.animname,
				frame: 0,
				flip: flip,
				type: Q._SPRITE_PARTICLE,
				collisionMask: Q._SPRITE_DEFAULT | Q._SPRITE_FRIENDLY,
			}
		);

		this.add("animation");

		this.on("hit", this, "collision");
		this.on("collisionDone");
		this.play("fly"); // start playing fly-sequence
	},

	// simple step function with ax and ay, speed- and pos-recalc, and collision detection
	step: function(dt) {
		var p = this.p;
		p.vx += p.ax*dt*(p.flip == "x" ? -1 : 1);
		p.x += p.vx * dt;
		p.vy += p.ay*dt;
		p.y += p.vy * dt;
		// check for collisions on this entity's stage
		this.stage.collide(this);
	},

	// we hit something
	collision: function(col) {
		var p = this.p, anim = p.animation;
		// we hit our own shooter -> ignore
		if (col.obj && col.obj === p.shooter) return;

		p.hitSomething = true;
		// stop abruptly
		p.ax = 0; p.vx = 0; p.ay = 0; p.vy = 0;
		// play 'hit' if exists, otherwise just destroy object
		if (p.animscheme["hit"]) {
			if (anim != 'hit') this.play("hit");
		}
		else this.collisionDone();
	},
	// we are done hitting something
	collisionDone: function() {
		this.destroy();
	}
});


// -------------------------------------
// THE ARROW
// -------------------------------------
Q.Shot.extend("Arrow",{
	init: function(p) {
		// set some defaults if not already given in p
		Q._defaults(p, {
			name: "Arrow",
			sprite: "arrow",
			sheet: "arrow",
			type: Q._SPRITE_PARTICLE | Q._SPRITE_ARROW,
			collisionMask: Q._SPRITE_DEFAULT | Q._SPRITE_ENEMY | Q._SPRITE_FRIENDLY,
			ax: -10,
			ay: 40,
			vx: 300,
			vy: -15,
			xoffset: 3,
			yoffset: -3,
			animname: "arrow",
			animscheme: {
					fly: { frames: [0,1,2,3], rate: 1/10 },
				},
		});
		this._super(p);
	},
});

// -------------------------------------
// A FIREBALL
// -------------------------------------
Q.Shot.extend("Fireball",{
	init: function(p) {
		// set some defaults if not already given in p
		Q._defaults(p, {
			name: "Fireball",
			type: Q._SPRITE_PARTICLE | Q._SPRITE_FIREBALL,
			collisionMask: Q._SPRITE_DEFAULT | Q._SPRITE_FRIENDLY,
			ax: 0,
			ay: 0,
			vx: 200,
			vy: 0,
			xoffset: 0,
			animname: "fireball",
			animscheme: {
					fly: { frames: [0,1], rate: 1/5 },
					hit: { frames: [4,5], rate: 1/3, loop: false, trigger: 'collisionDone' },
				},
			damage: 2, // a fireball causes more damage
		});
		this._super(p);
	},
});

// -------------------------------------
// A FIRESPITTER
// -------------------------------------
Q.Sprite.extend("Firespitter",{
	init: function(p) {
		Q._defaults(p, {w: 1, h: 1, x: 0, y: 0});
		Q._whTileToPix(p, _TILE_SIZE); // normalize some values (width and height given in tile-units, not pixels)

		this._super(p, {
			name: "Firespitter",
			asset: "empty_sprite.png",
			frame: 0,
			flip: false,
			type: Q._SPRITE_DEFAULT,

			frequency: 1/3, // shooting frequency (in 1/s)
			lastShotFired: 0, // keep track of last shot fired
			}
		);
	},
	step: function(dt) {
		var p = this.p;
		p.lastShotFired += dt;
		// time's up -> fire shot
		if (p.lastShotFired > (1 / p.frequency)) {
			p.lastShotFired = 0;
			this.fire();
		}
	},
	fire: function() {
		this.stage.insert(new Q.Fireball({shooter: this}));
	},
});


// -------------------------------------
// A MOVABLE ROCK
// -------------------------------------
Q.Sprite.extend("MovableRock",{
	init: function(p) {
		Q._defaults(p, {w: 2, h: 2, x: 0, y: 0}); // set default width and height (in case they are not given)
		Q._whTileToPix(p, _TILE_SIZE); // normalize some values (width and height given in tile-units, not pixels)
		this._super(p, {
			name: "MovableRock",
			sheet: "movable_rock",
			type: Q._SPRITE_DEFAULT,
			isPushable: true,
			isHeavy: true,
			dockedObjects: {}, // objects that are currently "sitting" on this and get moved along with it (e.g. someone stands on the rock, someone else pushes it -> person that's standing on the rock gets pushed along)
			vxmax: 20,
			maxFallSpeed: 600,
		});
		this.add("gamePhysics");

		this.p.collisionMask |= Q._SPRITE_CHARACTER ; // add characters to collisionMask after(!) applying gamePhysics defaults
	},
});


// -------------------------------------
// A LADDER
// -------------------------------------
Q.Sprite.extend("Ladder",{
	init: function(p) {
		Q._defaults(p, {w: 2, h: 10, x: 0, y: 0}); // set default width and height (in case they are not given)
		Q._xywhTileToPix(p, _TILE_SIZE); // normalize some values (everything given in tile-units, not pixels)

		// make collision with ladder to only trigger when player is relatively close to the x-center of the ladder
		//p.points = [[-p.w/8, -p.h/2],[p.w/8, -p.h/2],[p.w/8, p.h/2],[-p.w/8, p.h/2]];
		p.points = [[-1, -p.h/2],[1, -p.h/2],[1, p.h/2],[-1, p.h/2]];

		this._super(p, {
			asset: "empty_sprite.png",
			type: Q._SPRITE_LADDER,
			ybot: parseInt((p.y+p.h/2)),//+1),
			ytop: parseInt((p.y-p.h/2)),//+1),
			yalmosttop: parseInt((p.y-p.h/2)+12),
		});
	},
});

// -------------------------------------
// AN ELEVATOR
// -------------------------------------
Q.Sprite.extend("Elevator",{
	init: function(p) {
		Q._defaults(p, {
			vx: 0,
			vy: 100,
			ymin: 40,
			ymax: 300,
			w: 2, // set default width and height (in case they are not given)
			h: 1,
			x: 0,
			y: 0
			}
		);
		Q._whTileToPix(p, _TILE_SIZE); // normalize some values (width/height given in tile-units, not pixels)

		this._super(p, {
			asset: "elevator.png",
			type: Q._SPRITE_DEFAULT,
			path: "y",  // y: up and down elevator
						// x: left-right elevator
						// NOT YET: xy: rectangle elevator (direction is determined by start x/y-speeds)
						//
		});
	},
	// moving elevator up and down
	step: function(dt) {
		var p = this.p;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		if (p.y < p.ymin || p.y > p.ymax) {
			p.vy = -p.vy;
		}
	},
});



// -------------------------------------
// A LEVEL OBJECT
// -------------------------------------
Q.Evented.extend("Level",{
	init: function(p) {
		Q._defaults(p, {name: 'EGPT'}); // the levels 'name' (could be the password?)
		p.nameLc = p.name.toLowerCase();
		Q._defaults(p, {
				id: 0, // a unique ID
				tmxFile: p.name.toLowerCase()+".tmx",
				tmxObj: 0,
				sheets: ['baleog', 'erik', 'arrow', 'scorpion', 'enemies', 'scorpionshot', 'fireball', 'movable_rock'],
				assets: ['empty_sprite.png', 'elevator.png', 'bg_'+p.nameLc+'.png', 'generic.tsx', p.nameLc+'.tsx'],

				assetList: [],

				collisionLayerName: "collision",
				backgroundLayerName: "background",
				foregroundLayerName: "foreground",
				objectLayerName: "objects",

				playerCharacters: [], // holds all the vikings (Erik, Baleog, etc..) as objects

				fullyLoaded: false, // set to true if all assets have been loaded
				forcePlayWhenLoaded: false,
			}); // set some defaults, in case they are not given

		this.p = p;

		// build list of assets to load:
		// ... fixed assets
		p.assetList.push(p.tmxFile);
		// add pngs to all tsx files ([same name as tsx].png)
		for (var x = 0, l = p.assets.length; x < l; ++x)
			if (p.assets[x].match(/^([\w\-\.]+)\.tsx$/))
				p.assets.push(RegExp.$1 + ".png");
		p.assetList = p.assetList.concat(Q._normalizeArg(p.assets));
		// ... from sheets info
		for (var x = 0, l = p.sheets.length; x < l; ++x) {
			var name = p.sheets[x].toLowerCase(),
			    tsx = name+".tsx",
			    png = name+".png";
			p.assetList.push(png, tsx);
			// overwrite sheets array with clean, completed values
			p.sheets[x] = [name, tsx];
		}
	},

	// load all assets in assetList and trigger "ready" event
	load: function(forcePlay) {
		var p = this.p;
		p.forcePlayWhenLoaded = (forcePlay || false);

		// already loaded -> play?
		if (p.fullyLoaded) {
			if (this.p.forcePlayWhenLoaded)
				this.play();
			return;
		}

		// start loading all assets
		Q.load(p.assetList,
			// when loading is done, call this function with context=this
			function(args) {
				// read level's tmx file (will take care of generating sheet-objects for internal sheets)
				this.p.tmxObj = new Q.TmxFile(this.p.tmxFile);
				// generate other sheets needed for this level (given in p.sheets), all from tsx files
				Q._each(this.p.sheets,
					function(val, slot, arr) {
						Q.sheet(val[0], 0 /*no asset (we do: from Tsx -->)*/, { fromTsx: val[1] /*tsx filename*/ });
					},
					this);
				p.fullyLoaded = true;
				this.trigger("ready", this);
				if (this.p.forcePlayWhenLoaded) this.play();
			},
			{context: this});
	},

	// creates objects from TileLayer objects and adds them into the level's stage
	addObjectsFromTmx: function (stage, level, tmxObj) {
		var p = this.p, layer, obj_counts = { "ladder" : 0, "exit" : 0 };
		// layers
		for (var layerName in tmxObj.p.layers) {
			var tiles = tmxObj.p.layers[layerName];
			//var tiles = layer.p.tiles;
			var tilePropsByGID = tmxObj.p.tilePropsByGID;
			for (var y = 0, n = tiles.length; y < n; ++y) {
				for (var x = 0, l = tiles[y].length; x < l; ++x) {
					var props = tilePropsByGID[tiles[y][x]];
					if (! props) continue;
					// we hit the upper left corner of a ladder
					if (props["ladder"] &&
						(! (x > 0 && tilePropsByGID[tiles[y][x-1]] && tilePropsByGID[tiles[y][x-1]]["ladder"])) &&
						(! (y > 0 && tilePropsByGID[tiles[y-1][x]] && tilePropsByGID[tiles[y-1][x]]["ladder"]))
					) {
						// measure width and height
						var w = 1, h = 1;
						for (var x2 = x+1; ; ++x2) {
							var props2 = tilePropsByGID[tiles[y][x2]];
							if (! (props2 && props2["ladder"])) break;
							++w;
						}
						for (var y2 = y+1; ; ++y2) {
							var props2 = tilePropsByGID[tiles[y2][x]];
							if (! (props2 && props2["ladder"])) break;
							++h;
						}
						// insert new Ladder
						stage.insert(new Q.Ladder({ name: "Ladder"+(++obj_counts["ladder"]), x: x, y: y, w: w, h: h }));
					}
					/*// we hit the left tile of an exit
					else if (props["exit"] && (! (tilePropsByGID[tiles[y][x-1]] && tilePropsByGID[tiles[y][x-1]]["exit"]))) {
						// insert new exit
						stage.insert(new Q.Exit({ name: "Exit"+(++obj_counts["exit"]), x: x, y: y }));
					}*/
				}
			}
		}
		// objects
		for (var objGroupName in tmxObj.p.objectgroups) {
			var objects = tmxObj.p.objectgroups[objGroupName];
			for (var x = 0, l = objects.length; x < l; ++x) {
				var object = objects[x];
				var props = Q._clone(object); // shallow copy to avoid changing of the object in the object-layer by the Sprite's c'tor
				var options = {};
				// remove ()-properties (those are "private" and should not go into Sprite's c'tor)
				for (var prop in object) {
					if (prop.match(/^\(([\w\.\-]+)\)$/))
						options[RegExp.$1] = Q._popProperty(props, prop);
				}
				// a sprite -> call c'tor with all given properties
				var ctor = 0, sprite = options.sprite;
				if (sprite && (ctor = Q[sprite])) {
					// set xmax and ymax automatically for player and enemy sprites
					if (options.isPlayer || options.isEnemy)
						Q._defaults(props, { xmax: stage.options.levelObj.p.collisionLayer.p.w, ymax: stage.options.levelObj.p.collisionLayer.p.h });
					obj_counts[sprite] = (++obj_counts[sprite] || 1);
					if (! options.name) {
						props.name = sprite+(options.isPlayer ? "" : obj_counts[sprite]);
					}
					// create and insert the object
					var obj = stage.insert(new ctor(props));
					// shift object to match center positions (positions in tmx file are bottom/left positions, not center positions)
					obj.p.x += obj.p.cx;
					obj.p.y -= obj.p.cy;
					// add vikings to levels player-list
					if (options["isPlayer"]) level.p.playerCharacters.push(obj);
				}
			}
		}
	},

	// plays the level (stages the scene)
	play: function() {
		var p = this.p;

		// not loaded yet? -> load first
		if (!p.fullyLoaded) {
			this.load(true);
			return;
		}

		// switch on keyboard
		Q.input.keyboardControls({
			LEFT: 'left',
			RIGHT: 'right',
			UP: 'up',
			DOWN: 'down',
			SPACE: 'action1',
			D: 'action2',
			S: 'act',
			E: 'use',
			CTRL: 'ctrl',
			TAB: 'tab',
			ESC: 'esc',
		});

		// register touch events
		Q.touch(Q._SPRITE_FRIENDLY, [0]);

		// define the level's scene
		Q.scene(p.name, function(stage) {
			// adds the "viewport" component to this stage, which allows us to "follow" certain characters
			// adds the "viewport" component to this stage, which allows us to "follow" certain characters
			stage.add("viewport");

			// get the level handlers
			var level = stage.options.levelObj,
				p     = level.p;

			// super background (far away)
			p.superBackground = stage.insert(
				new Q.Repeater({
					asset: 'bg_'+p.nameLc+'.png',
					speedX: 0.9,
					speedY: 0,
					repeatY: false,
					hidden: (Q.debug & Q._DEBUG_RENDER_COLLISION_LAYER),
					})
				);

			// hide collision layers behind background so we don't see the collision layer
			if (p.collisionLayerName) {
				p.collisionLayer = stage.collisionLayer(
					new Q.TileLayer({
						tmxObj: p.tmxObj,
						layerName: p.collisionLayerName,
						render: (Q.debug & Q._DEBUG_RENDER_COLLISION_LAYER),
						})
					);
			}

			// put background on top of collision layer
			if (p.backgroundLayerName) {
				p.backgroundLayer = stage.insert(
					new Q.TileLayer({
						type: Q._SPRITE_NONE,
						tmxObj: p.tmxObj,
						layerName: p.backgroundLayerName,
						render: (! (Q.debug & Q._DEBUG_RENDER_COLLISION_LAYER)),
						})
					);
			}

			// insert objects (ladders, enemies, vikings, etc..)
			// by looping through all tiles of the background/foreground/object layers
			level.addObjectsFromTmx(stage, level, p.tmxObj);

			if (p.foregroundLayerName) {
				p.foregroundLayer = stage.insert(
					new Q.TileLayer({
						type: Q._SPRITE_NONE,
						tmxObj: p.tmxObj,
						layerName: p.foregroundLayerName,
						render: (! (Q.debug & Q._DEBUG_RENDER_COLLISION_LAYER)) 
						})
					);
			}
		});

		// start level (stage the scene; will overwrite the old 0-stage (=main-stage))
		Q.stageScene(p.name, 0/*=stage ID*/, { levelObj: this } /*<-this options-object will be stored in stage.options*/);

		// handle characters deaths
		Q._each(p.playerCharacters, function(val, slot, arr) {
			val.on("dead", this, "_characterDied");
		}, this);

		// manage the characters in this level
		Q.state.set("Characters", p.playerCharacters);
		Q.state.on("change.activeCharacter", this, "_activeCharacterChanged");
		Q.state.set("activeCharacter", 0);
		Q.state.set("origNumCharacters", p.playerCharacters.length);

		// activate Ctrl switch vikings
		Q.input.on('ctrl', this, "_nextActiveCharacter");
		// activate stage's escape menu
		Q.input.on('esc', this, "_escapeMenu");

		// activate level triggers
		this.on("reachedExit", this, "_characterReachedExit");
	},

	done: function() {
		Q.stage().stop();
		Q.state.set("activeCharacter", undefined);
		// switch off keyboard
		Q.input.keyboardControls({});
		// unset touch event handlers
		Q.touchInput.off("swipe");
		Q.touchInput.off("tap");
	},

	_escapeMenu: function() {
		Q.stageScene(new Q.Scene(function (stage) {
			Q.stage(0).pause();
			var box = stage.insert(new Q.UI.Container({
				x: Q.width/2,
				y: Q.height/2,
				fill: "rgba(255,255,255,0.75)"
				}));
			var label = stage.insert(new Q.UI.Text(
				{ x: 0, y: -10 - 30, w: 100, align: "center", label: "Give up?", color: "black",}
				), box);
			var yes = stage.insert(new Q.UI.Button(
				{ x: 0, y: 0, fill: "#CCCCCC", label: "Yes"},
				function() { stage.options.levelObj.trigger("aborted", stage.options.levelObj); }
				), box);
			var no = stage.insert(new Q.UI.Button(
				{ x: yes.p.w + 20, y: 0, w: yes.p.w, fill: "#CCCCCC", label: "No" },
				function() { Q.clearStage(1); Q.stage(0).unpause(); }
				), box);
			box.fit(20);
		}), 1, {levelObj: this});
	},

	// handles a dead character
	_characterDied: function(character) {
		// remove the guy from the Characters list
		var characters = Q.state.get("Characters");
		var active = Q.state.get("activeCharacter");
		// remove the guy from characters list
		for (var i = 0, l = characters.length; i < l; ++i) {
			// found the dead guy
			if (characters[i] === character) {
				characters.splice(i, 1);
				// no one left for the player to control -> game over, man!
				if (characters.length == 0) {
					alert("You lost!\nClearing stage 0.");
					this.trigger("lost", this);
				}
				// if character was the active one, make next character in list the new active one
				else if (i == active) {
					// was the last one in list, make first one the active guy
					if (i == characters.length) {
						Q.state.dec("activeCharacter", 1); // decrement by one: will now point to last character in list ...
						this._nextActiveCharacter(); // ... will move pointer to first element in list
					}
					// leave active pointer where it is and call _activeCharacterChanged
					else
						this._activeCharacterChanged([i /*new val*/, i /*old val (not used anyway)*/]);
				}
				break;
			}
		}
	},

	// handles a character reaching the exit
	_characterReachedExit: function(character) {
		var characters = Q.state.get("Characters");
		var num_reached_exit = 0, still_alive = characters.length;
		// check all characters' status (dead OR reached exit)
		for (var i = 0; i < still_alive; ++i) {
			// at exit
			if (characters[i].p.atExit) ++num_reached_exit;
		}
		// all original characters reached the exit (level won)
		if (num_reached_exit == Q.state.get("origNumCharacters")) {
			alert("Great! You made it!");
			this.done();
			this.trigger("mastered", this);
		}
		// everyone is at exit, but some guys died
		else if (num_reached_exit == still_alive) {
			alert("Sorry, all of you have to reach the exit.");
			this.done();
			//TODO: 2) fix black screen mess when level lost or aborted
			this.trigger("lost", this);
		}
	},

	// returns the next active character (-1 if none)
	// and moves the activeCharacter pointer to that next guy
	_nextActiveCharacter: function () {
		var slot = Q.state.get("activeCharacter");
		if (typeof slot == 'undefined') return -1;
		var characters = Q.state.get("Characters");
		var next = ((slot+1) % characters.length);
		Q.state.set("activeCharacter", next);
		return next;
	},

	// reacts to a change in the active character to some new slot
	// - changes the viewport follow to the new guy
	_activeCharacterChanged: function (params/*=new val, old val*/) {
		var characters = Q.state.get("Characters");
		// someone is active
		if (typeof params[0] != 'undefined') {
			for (var i = 0, l = characters.length; i < l; ++i) {
				if (i != params[0]) {
					var ac = i; // activate on-tap-becomes-active
					characters[i].deactivate().on("tap", function() { Q.state.set("activeCharacter", ac); });
				}
				else {
					characters[i].activate().off("tap");
				}
			}
			var stage = Q.stage(0); // default stage
			stage.follow(characters[params[0]], {x: true, y: true}, {minX: 0, maxX: this.p.collisionLayer.p.w, minY: 0, maxY: this.p.collisionLayer.p.h}, (typeof params[1] == 'undefined' ? 0 : 15)/*max follow-speed (only when not first character)*/)
			characters[params[0]].blink(15, 1.5); // 15/s for 1.5s
		}
		// no one is active anymore -> switch 'em all off
		else {
			for (var i = 0, l = characters.length; i < l; ++i) {
				characters[i].deactivate().off("tap");
			}
		}
	},

});


// -------------------------------------
// A SCREEN OBJECT
// (simpler than a level, however Level
// does not inherit from Screen)
// -------------------------------------
Q.Evented.extend("Screen",{
	init: function(p) {
		Q._defaults(p, {name: 'start'}); // the screen's 'name'
		Q._defaults(p, {
				id: 0, // a unique ID
				sprites: [], // sprites (could be plain images), loads sprite's asset
				labels: [], // text labels (no assets to load)
				audio: [], // audio assets
				assets: [], // other assets needed
				assetList: [], // ready-compiled list of assets to load before this screen can be played
				fullyLoaded: false, // set to true if all assets have been loaded
				forcePlayWhenLoaded: false,
			});

		this.p = p;

		// build list of assets to load:
		for (var x = 0, l = p.sprites.length; x < l; ++x)
			if (p.sprites[x].asset) p.assets.push(p.sprites[x].asset);
		for (var x = 0, l = p.audio.length; x < l; ++x)
			p.assets.push(p.audio[x]);
		p.assetList = p.assetList.concat(Q._normalizeArg(p.assets));
	},

	// load all assets in assetList and trigger "ready" event
	load: function(forcePlay) {
		var p = this.p;
		p.forcePlayWhenLoaded = (forcePlay || false);

		// already loaded -> play?
		if (p.fullyLoaded) {
			if (this.p.forcePlayWhenLoaded) {
				console.log("screen "+p.name+" already loaded: forcePlay'ing screen");
				this.play();
			}
			return;
		}

		// start loading all assets
		//console.log("loading screen "+p.name+" with assets: "+p.assetList);
		Q.load(p.assetList,
			// when loading is done, call this function with context=this
			function(args) {
				p.fullyLoaded = true;
				//console.log("screen "+p.name+" loaded: forcePlayWhenLoaded="+this.p.forcePlayWhenLoaded);
				this.trigger("ready", this);
				if (this.p.forcePlayWhenLoaded) {
					this.play();
				}
			},
			{context: this});
	},


	// plays the screen (stages the scene)
	play: function() {
		var p = this.p;

		// switch on keyboard?
		if (p.input) {
			if (p.input.keyboardControls) {
				Q.input.keyboardControls(p.input.keyboardControls);
			}
			if (p.input.touchControls) {
				Q.touch(p.input.touchControls);
			}
		}

		// play first audio
		if (p.audio && p.audio[0]) {
			Q.audio.stop(); // stop all previous sounds
			Q.audio.play(p.audio[0]);
		}

		// define the screen's scene
		Q.scene(p.name, function(stage) {
			var screen = stage.options.screenObj;
			var p = screen.p;

			// insert labels to screen
			var labels = {}, obj;
			for (var x = 0, l = p.labels.length; x < l; ++x) {
				p.labels[x].screenObj = screen;
				obj = stage.insert(new Q.UI.Text(p.labels[x]));
				if (p.labels[x]["name"]) labels[p.labels[x]["name"]] = obj;
			}
			// overwrite p.labels with the nicely mapped label hash
			p.labels = labels;

			// insert objects to screen
			var sprites = {};
			for (var x = 0, l = p.sprites.length; x < l; ++x) {
				p.sprites[x].screenObj = screen;
				var ctor = Q._popProperty(p.sprites[x], "definition");
				if (ctor) {
					ctor = Q.Sprite.extend(ctor);
					obj = stage.insert(new ctor(p.sprites[x]));
				}
				else {
					obj = stage.insert(new Q.Sprite(p.sprites[x]));
				}
				if (p.sprites[x]["name"]) sprites[p.sprites[x]["name"]] = obj;
			}
			// overwrite p.labels with the nicely mapped label hash
			p.sprites = sprites;
		});

		// start screen (stage the scene; will overwrite the old 0-stage (=main-stage))
		Q.stageScene(p.name, 0/*=stage ID*/, { screenObj: this } /*<-this options-object will be stored in stage.options*/);
	},
});


// -------------------------------------
// A Game Manager Object
// - manages displaying the level and
//   other screens (start screen, etc..)
// -------------------------------------
Q.Evented.extend("GameManager", {
	init: function(p) {
		Q._defaults(p, {
			screensToLoad: ["start"],
			screens: {},
			levelsToLoad: ["STRT"], // list of level names to generate
			levels: {}, // holds the level objects by key=level name
		});
		this.p = p;

		// initialize all screens
		for (var x = 0, l = p.screensToLoad.length; x < l; ++x) {
			var opts = (Q._isString(p.screensToLoad[x]) ? { name: p.screensToLoad[x] } : p.screensToLoad[x]);
			opts.name = (opts.name || "screen"+(x < 10 ? "0"+x : x));
			opts.gameManager = this;
			var screen = p.screens[opts.name] = new Q.Screen(opts);
			//console.log("loading screen "+screen.p.name+"("+(screen.p.name == "start")+")");
			screen.load(screen.p.name == "start"); // load the first screen (its assets) and play it when done
		}
		// initialize all levels
		for (var x = 0, l = p.levelsToLoad.length; x < l; ++x) {
			var opts = (Q._isString(p.levelsToLoad[x]) ? { name: p.levelsToLoad[x] } : p.levelsToLoad[x]);
			opts.name = (opts.name || "LV"+(x < 10 ? "0"+x : x));
			opts.id = x;
			opts.gameManager = this;
			var level = p.levels[opts.name] = new Q.Level(opts);
			// register events
			level.on("ready", this, "levelReady");
			level.on("mastered", this, "levelMastered");
			level.on("aborted", this, "levelAborted");
			level.on("lost", this, "levelLost");
			if (x == 0) level.load(false); // load the first level (its assets)
		}
	},

	// returns the next level (if exists) as object
	// false if no next level
	getNextLevel: function(level) {
		return (this.p.levels[this.p.levelsToLoad[(Q._isNumber(level) ? level : level.p.id)+1]] || false);
	},

	// a level is ready (assets have been loaded)
	// -> if 1st level is ready: load 2nd level, but don't play it
	levelReady: function(level) {
		var id = level.p.id;
		if (id == 0) {
			var next = this.getNextLevel(id);
			if (next) next.load(false);
		}
	},

	// a level has been successfully finished
	// load/play next one
	levelMastered: function(level) {
		var next = this.getNextLevel(level);
		if (next) next.load(true);
		else alert("All done!! Congrats!!");
	},

	// a level has been aborted
	levelAborted: function(level) {
		Q.clearStages();
		this.p.screens["start"].play();
	},

	// a level has been lost (all characters died)
	levelLost: function(level) {
		this.levelAborted(level); // for now: same as aborted level
	},
});



// -------------------------------------
// MAIN CODE
// -------------------------------------
{
	// create GAME object that manages the entire game (stages levels and other scenes/screens)
	var GAME = Q.GAME = new Q.GameManager({
		screensToLoad: [
			{	name: "start",
				input: {
					keyboardControls: {
							UP: 'up',
							DOWN: 'down',
							SPACE: 'select',
							RETURN: 'select',
						},
					touchControls: {
							type: Q._SPRITE_UI,
							register: [{event: "tap", obj: true}],
						},
					},
				sprites: [
					{ name: "header", x: Q.width/2, y: 100, asset: "menu.png" }, // regular Sprite
					// anonymous Sprite
					{ name: "selector",
					  x: Q.width/2-100,
					  y: 200,
					  asset: "menu_selector.png",
					  toSelect: [[220, "WRBC"], [260, "password"], [300, "fakedos"]],
					  selected: 0,
					  definition: {
						init: function(p) {
							p.y = p.toSelect[p.selected][0];
							this._super(p);
							Q.input.on('up', this, "moveUp");
							Q.input.on('down', this, "moveDown");
							Q.input.on('select', this, "menuSelect");
							// TEST: FOR NOW ONLY
							Q.touchInput.on("tap", this, "TEST_tapped");
						},
						TEST_tapped: function(touch) {
							if (touch.x < 200) {
								this.p.selected = 0;
							}
							else if (touch.x < 300) {
								this.p.selected = 1;
							}
							else if (touch.x < 400) {
								this.p.selected = 2;
							}
							this.menuSelect();
						},
						//END:TEST
						menuSelect: function() {
							var p = this.p, toPlay = p.toSelect[p.selected][1];
							// level
							if (toPlay.toUpperCase() == toPlay) {
								Q.GAME.p.levels[toPlay].play();
							}
							// screen
							else {
								Q.GAME.p.screens[toPlay].play();
							}
						},
						moveUp: function() {
							var p = this.p;
							// move one up (if possible)
							if (p.selected > 0) {
								--p.selected;
								p.y = p.toSelect[p.selected][0];
							}
						},
						moveDown: function() {
							var p = this.p;
							// move one down (if possible)
							if (p.selected < (p.toSelect.length-1)) {
								++p.selected;
								p.y = p.toSelect[p.selected][0];
							}
						}
						},
					},
					],
				//buttons: [],
				labels: [
					{x: Q.width/2, y: 220, w: 150, label: "NEW GAME",    color: "white", align: "left", weight: "900", size: 22, family: "Fixedsys"},
					{x: Q.width/2, y: 260, w: 150, label: "PASSWORD",    color: "white", align: "left", weight: "900", size: 22, family: "Fixedsys"},
					{x: Q.width/2, y: 300, w: 150, label: "EXIT TO DOS", color: "white", align: "left", weight: "900", size: 22, family: "Fixedsys"},
					],
				//audio: ["title.mp3"],
			},

			// Password Screen
			{	name: "password",
				sprites: [
					{ name: "header", x: Q.width/2, y: 100, asset: "menu.png" },
					{ name: "selector",
					  //x: Q.width/2-100,
					  y: 248,
					  asset: "password_selector.png",
					  toSelect: [Q.width/2-27, 18, 18, 19],
					  selected: 0,
					  definition: {
						init: function(p) {
							p.x = p.toSelect[0];
							p.passwd = "WRBC";
							this._super(p);
							Q.input.keyboardControls({
								LEFT: 'left',
								BACKSPACE: 'left',
								RIGHT: 'right',
								SPACE: 'enter',
								RETURN: 'enter',
								ESC: 'escape',
							}, {letters: true, numbers: true});
							Q.input.on('keydown', this, "keyDown");
						},
						keyDown: function(args) {
							var keycode = args[0], action = args[1];
							if (action == 'left') this.moveLeft();
							else if (action == 'right') this.moveRight();
							else if (action == 'enter') this.passwdEnter();
							else if (action == 'escape') Q.GAME.p.screens["start"].play();
							else if (action != 'select') {
								var p = this.p, pwd = p.passwd;
								p.passwd = "";
								for (var x = 0; x < p.toSelect.length; ++x) {
									p.passwd += (x == p.selected ? String.fromCharCode(keycode) : pwd.substr(x, 1));
								}
								p.screenObj.p.labels["password"].p.label = p.passwd; // refresh the label
								this.moveRight();
							}
						},
						passwdEnter: function() {
							var p = this.p;
							if (Q.GAME.p.levels[p.passwd]) {
                                Q.GAME.p.levels[p.passwd].play();
                            }
							else {
								alert("does not exist!");
							}
						},
						moveLeft: function() {
							var p = this.p;
							// move one left (if possible)
							if (p.selected > 0) {
								--p.selected;
								p.x = p.x-p.toSelect[p.selected+1];
							}
						},
						moveRight: function() {
							var p = this.p;
							// move one right (if possible)
							if (p.selected < (p.toSelect.length-1)) {
								++p.selected;
								p.x = p.toSelect[p.selected] + (p.selected == 0 ? 0 : p.x);
							}
						}
						},
					},
					],
				labels: [
					{                  x: Q.width/2, y: 200, label: "Password:", color: "white", align: "left", weight: "900", size: 30, family: "Courier" },
					{ name: "password", x: Q.width/2, y: 250, label: "WRBC",      color: "white", align: "left", weight: "900", size: 30, family: "Courier" },
					],
			},
			],
		levelsToLoad: [
			{
				name: "WRBC",
			},
			"EGPT",
			"TEST",
			"TT01",
			"TT02",
			],
		});
}

}); // end: addEventListener("load" ...



// -------------------------------------
// standalone functions
// -------------------------------------

// rerenders the entire canvas for debugging purposes
// - can be called at any time during a sprite's step method
function renderAllForDebug(Q, sprite) {
	sprite.refreshMatrix();
	Q._generateCollisionPoints(sprite);

	if(Q.ctx) { Q.clear(); }

	for(i =0,len=Q.stages.length;i<len;i++) {
		Q.activeStage = i;
		stage = Q.stage();
		if(stage) {
			stage.render(Q.ctx);
		}
	}
	Q.activeStage = 0;//sprite.stage; //??? stage number, not object
	if(Q.input && Q.ctx) { Q.input.drawCanvas(Q.ctx); }
}
