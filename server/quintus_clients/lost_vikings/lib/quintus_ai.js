/*global Quintus:false */

Quintus.AI = function(Q) {
	Q.component("aiBrain", {
		added: function(p) {
			var entity = this.entity;

			Q._defaults(entity.p,{
				brainCommands: {
					left: true,
					right: false,
				},
			});
			entity.on('prestep', this, 'step'); // run this component's step function before character's one

			entity.on('bump.right', this, 'toggleDirection');
			entity.on('bump.left', this, 'toggleDirection');
		},

		// sends brainCommands to 'muscles' (left, right, etc..)
		step: function(dt) {
			var entity = this.entity, p = entity.p;
			var nocontrol = (p.animationFlags & Q.ANIM_DISABLES_CONTROL);
			p.brainCommands['right'] = p.brainCommands['left'] = false;

			//if (nocontrol) {
			//	p.brainCommands['bite'] = p.brainCommands['shoot'] = false;
			//}
			//else {
				// look for edges ahead -> then change direction if one is detected
				// - makes sure an enemy character does not fall off a cliff
				if ((!(Q._loopFrame % 3) && this.checkCliffAhead()) || p.x <= 0 || p.x >= p.xmax) {
					this.toggleDirection();
				}
				p.brainCommands[(p.flip ? 'left' : 'right')] = true;
			//	p.brainCommands['bite'] = false; // TODO
			//	p.brainCommands['shoot'] = false;
			//}
		},

		toggleDirection: function() {
			var p = this.entity.p;
			p.flip = (p.flip == 'x' ? false : 'x');
		},

		// checks whether there is a cliff ahead (returns true if yes)
		checkCliffAhead: function() {
			var entity = this.entity, p = entity.p, tileh = entity.stage._collisionLayer.p.tileH;
			// check below character (c=character sprite, _=locateObject (a stripe with x=x width=w-6 and height=3))
			// ccc    -> walking direction
			// ccc
			//  _
			var testcol = entity.stage.locate(p.x+p.w/2*(p.flip == 'x' ? -1 : 1), p.y+p.cy+(tileh*1.5)/2, (Q._SPRITE_DEFAULT | Q._SPRITE_LADDER), p.w-6, tileh*1.5);
			if ((!testcol) || (testcol.tileprops && testcol.tileprops['liquid'])) {
				return true;
			}
			return false;
		},

		// checks whether an enemy is in sight
		checkEnemyAhead: function() {
			
		},

	});
};


/*Q.component("scorpionBrain", {
	added: function() {
		var entity = this.entity;
		Q._defaults(entity.p,{
			brainCommands: {
				left: true,
				right: false,
				shoot: false,
			},
		});
		entity.on('prestep',this,'step'); // run this component's step function before player's one
	},
	// sends brainCommands to scorpion 'muscles' (left, right, shoot)
	step: function(dt) {
		var entity = this.entity, p = entity.p;
		var nocontrol = (p.animationFlags & Q.ANIM_DISABLES_CONTROL);

		if (nocontrol) {
			p.brainCommands['right'] = false;
			p.brainCommands['left'] = false;
			p.brainCommands['shoot'] = false;
		}
		else {
			// keep walking
			p.brainCommands[(p.flip ? 'left' : 'right')] = true;
			// shoot?
			if (Math.random() <= 0.01) {
				p.brainCommands['right'] = false;
				p.brainCommands['left'] = false;
				p.brainCommands['shoot'] = true;
			}
			// look for edges ahead -> then change direction if one is detected
			else if (p.x < 300) {
				p.brainCommands['right'] = true;
				p.brainCommands['left'] = false;
				p.brainCommands['shoot'] = false;
			}
			else if (p.x > 700) {
				p.brainCommands['right'] = false;
				p.brainCommands['left'] = true;
				p.brainCommands['shoot'] = false;
			}
		}
	},
});*/
