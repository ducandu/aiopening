/*global Quintus:false */

Quintus.Sprites = function(Q) {
 
  // Create a new sprite sheet
  // Options:
  //  tilew - tile width
  //  tileh - tile height
  //  w     - width of the sprite block
  //  h     - height of the sprite block
  //  sx    - start x
  //  sy    - start y
  //  cols  - number of columns per row
  //  fromTsx - set to tsx file name if you want to load this sheet's properties from an xml (=tsx) file
  //          - set to <tileset>-object (from xml parser) if you want to create SpriteSheet from <tileset>-object
  //  tilePropsByID - the properties for individual tiles within the sheet; hash: key=tileID (local!); value=hash with key/value pairs matching the "properties" defined in the xml (tsx) file
  Q.Class.extend("SpriteSheet",{
    init: function(name, asset, options) {
      console.assert(Q.asset(asset) || (options && options.fromTsx && ((Q._isString(options.fromTsx) && Q.asset(options.fromTsx)) || (! Q._isString(options.fromTsx)))), "No asset loaded yet for sheet "+name+"!");
      Q._extend(this,{
        name: name, // name of the sheet (call 'Q.sheet(name)' to retrieve spritesheet)
        asset: asset, // the png file
        w: (asset ? Q.asset(asset).width : 100),
        h: (asset ? Q.asset(asset).height : 100),
        tilew: 64,
        tileh: 64,
        sx: 0,
        sy: 0,
        fromTsx: false,
        tilePropsByID: {},
        });
      if(options) { Q._extend(this, options); }

      // read image name and properties from xml
      if (this.fromTsx) {
        var tsx = this.fromTsx;
        var sheet;
        if (Q._isString(tsx)) { // filename
          var parser = new DOMParser(),
              doc = parser.parseFromString(Q.asset(tsx), "application/xml"),
              tilesets = doc.getElementsByTagName("tileset");
          console.assert(tilesets.length == 1, "Not exactly 1 tileset found in tsx file "+tsx+"!");
          sheet = tilesets[0];
        }
        else { // already an object (<tileset>-tag)
          sheet = tsx;
        }
        var name = sheet.getAttribute("name"),
            tilew = parseInt(sheet.getAttribute("tilewidth")),
            tileh = parseInt(sheet.getAttribute("tileheight")),
            image = sheet.getElementsByTagName("image")[0].getAttribute("source").replace(/^.+\//, "");
        // the name of the sheet should always match the filename (e.g. strt.tsx should contain the tileset with the name 'strt')
        console.assert(name == this.name, "Name of tileset in tsx file ("+name+") does not match given name for SpriteSheet ("+this.name+")!");
        console.assert(Q.asset(image), "No image asset ("+image+") loaded yet for sheet "+name+"!");
        this.asset = image;
        this.w = Q.asset(image).width;
        this.h = Q.asset(image).height;
        this.tilew = tilew;
        this.tileh = tileh;

        // read the properties of the tiles (e.g. ladder, objects, etc..)
        var tiles = sheet.getElementsByTagName("tile");
        for (var x = 0, l = tiles.length; x < l; ++x) {
           var id = parseInt(tiles[x].getAttribute("id"));
           var p = tiles[x].getElementsByTagName("properties")[0];
           if (p) {
              var ps = p.getElementsByTagName("property");
              for (var y = 0, n = ps.length; y < n; ++y) {
                if (! this.tilePropsByID[id]) this.tilePropsByID[id] = {};
                var val = ps[y].getAttribute("value");
                var intval = parseInt(val);
                this.tilePropsByID[id][ps[y].getAttribute("name")] = (isNaN(intval) ? val : intval);
              }
           }
        }
      }

      this.cols = this.cols || Math.floor(this.w / this.tilew);
    },

    fx: function(frame) {
      return Math.floor((frame % this.cols) * this.tilew + this.sx);
    },

    fy: function(frame) {
      return Math.floor(Math.floor(frame / this.cols) * this.tileh + this.sy);
    },

    draw: function(ctx, x, y, frame) {
      if(!ctx) { ctx = Q.ctx; }
      ctx.drawImage(Q.asset(this.asset),
                    this.fx(frame),this.fy(frame),
                    this.tilew, this.tileh,
                    Math.floor(x),Math.floor(y),
                    this.tilew, this.tileh);

    }

  });


  Q.sheets = {};
  Q.sheet = function(name,pngAsset,options) {
    var asset = pngAsset || (options && options.fromTsx ? options.fromTsx : 0);
    // sheet does not exist yet AND asset given -> create sheet
    if (asset && (! Q.sheet(name))) {
      //console.assert(! Q.sheet(name), "Sheet "+name+" already exists, no need to create it again from '"+asset+"'!");
      console.assert((! Q._isString(asset)) || Q.asset(asset), "Asset: "+asset+" not loaded yet!");
      return (Q.sheets[name] = new Q.SpriteSheet(name,pngAsset,options));
    }
    // return already existing sheet
    else {
      return Q.sheets[name];
    }
  };

  Q.compileSheets = function(imageAsset,spriteDataAsset) {
    var data = Q.asset(spriteDataAsset);
    Q._each(data,function(spriteData,name) {
      Q.sheet(name,imageAsset,spriteData);
    });
  };


  // a sprite will collide via the collide function if it shares at least one bit between its collisionMask and the type of the other object
  Q._SPRITE_NONE     =    0x0; // doesn't collide with anything
  Q._SPRITE_DEFAULT  =    0x1; // e.g. collision layer
    Q._SPRITE__GROUND  =  0x2; // subtype of DEFAULT (if Sprite touches the ground (as opposed to a wall))
    Q._SPRITE__WALL    =  0x4; // subtype of DEFAULT (if Sprite touches a wall (as opposed to the ground))
  Q._SPRITE_PARTICLE =    0x8;
  Q._SPRITE_FRIENDLY =   0x10; // e.g. player
  Q._SPRITE_ENEMY    =   0x20; // e.g. scoprion
    Q._SPRITE_CHARACTER =0x30; // all characters (enemies and friends)
  Q._SPRITE_UI       =   0x40;
  Q._SPRITE_LADDER   =   0x80; // a ladder
  Q._SPRITE_ARROW    =  0x100; // an arrow
  Q._SPRITE_FIREBALL =  0x200; // a fireball
  Q._SPRITE_EXIT     =  0x400; // an exit
  Q._SPRITE_ALL      = 0xFFFF;


  Q._generatePoints = function(obj,force) {
    if(obj.p.points && !force) { return; }
    var p = obj.p,
        halfW = p.w/2,
        halfH = p.h/2;

    p.points = [ 
      [ -halfW, -halfH ],
      [  halfW, -halfH ],
      [  halfW,  halfH ],
      [ -halfW,  halfH ]
      ];
  };

  // changes the points
  // FOR NOW: only from top in y-direction AND assuming that it's a rectangle starting from the top-left and moving clockwise
  Q._changePoints = function(obj, dx, dy) {
    var p = obj.p, points = p.points;
    //fromWhere = fromWhere || "top";
    //if (fromWhere == "top") {
    points[0][1] += dy;
    points[1][1] += dy;
    //}
    Q._generateCollisionPoints(obj); // regenerate collisionPoints
  };


 Q._generateCollisionPoints = function(obj) {
    if(!obj.matrix && !obj.refreshMatrix) { return; }
    if(!obj.c) { obj.c = { points: [] }; }
    var p = obj.p, c = obj.c;

    if(!p.moved && 
       c.origX === p.x &&
       c.origY === p.y &&
       c.origScale === p.scale &&
       c.origAngle === p.angle) {
        return;
    }

    c.origX = p.x;
    c.origY = p.y;
    c.origScale = p.scale;
    c.origAngle = p.angle;

    obj.refreshMatrix();

    var container = obj.container || Q._nullContainer;

    // TODO: see if we care or if it's more 
    // efficient just to do the calc each time
    c.x = container.matrix.transformX(p.x,p.y);
    c.y = container.matrix.transformY(p.x,p.y);
    c.angle = p.angle + container.c.angle;
    c.scale = (container.c.scale || 1) * (p.scale || 1);

    var minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

    for(var i=0;i<obj.p.points.length;i++) {
      if(!obj.c.points[i]) {
        obj.c.points[i] = [];
      }
      obj.matrix.transformArr(obj.p.points[i],obj.c.points[i]);
      var x = obj.c.points[i][0],
          y = obj.c.points[i][1];

          if(x < minX) { minX = x; }
          if(x > maxX) { maxX = x; }
          if(y < minY) { minY = y; }
          if(y > maxY) { maxY = y; }
    }

    if(minX === maxX) { maxX+=1; }
    if(minY === maxY) { maxY+=1; }

    c.cx = c.x - minX;
    c.cy = c.y - minY;

    c.w = maxX - minX;
    c.h = maxY - minY;

    // TODO: Invoke moved on children
  };
  
  
  
// Properties:
  //    x
  //    y
  //    z - sort order
  //    sheet or asset
  //    frame
  Q.GameObject.extend("Sprite",{
    init: function(props,defaultProps) {
      this.p = Q._extend({ 
        x: 0,
        y: 0,
        z: 0,
        opacity: 1,
        angle: 0,
        frame: 0,
        type: (Q._SPRITE_DEFAULT | Q._SPRITE_FRIENDLY),
      },defaultProps);

      this.matrix = new Q.Matrix2D();
      this.children = [];

      Q._extend(this.p,props);

      this.size();
      this.p.id = this.p.id || Q._uniqueId();

      this.c = { points: [] };

      this.refreshMatrix();

      //console.assert((this.p.sheet || this.p.asset), "Neither asset nor sheet given in Sprite's c'tor for sprite with name="+this.p.name+"!");

    },

    // Resets the width, height and center based on the
    // asset or sprite sheet
    size: function(force, ignoreAsset) {
      if((!ignoreAsset) && (force || (!this.p.w || !this.p.h))) {
        if(this.asset()) {
          this.p.w = this.asset().width;
          this.p.h = this.asset().height;
        } else if(this.sheet()) {
          this.p.w = this.sheet().tilew;
          this.p.h = this.sheet().tileh;
        }
      }

      this.p.cx = (force || this.p.cx === void 0) ? (this.p.w / 2) : this.p.cx;
      this.p.cy = (force || this.p.cy === void 0) ? (this.p.h / 2) : this.p.cy;
    },

    // Get or set the asset associate with this sprite
    asset: function(name, resize) {
      if(!name) { return Q.asset(this.p.asset); }

      this.p.asset = name;
      if(resize) {
        this.size(true);
        Q._generatePoints(this,true);
      }
    },

    // Get or set the sheet associated with this sprite
    sheet: function(name, resize) {
      if(!name) { return Q.sheet(this.p.sheet); }

      this.p.sheet = name;
      if(resize) { 
        this.size(true);
        Q._generatePoints(this,true);
      }
    },

    hide: function() {
      this.p.hidden = true;
    },

    show: function() {
      this.p.hidden = false;
    },

    set: function(properties) {
      Q._extend(this.p,properties);
      return this;
    },

    _sortChild: function(a,b) {
      return ((a.p && a.p.z) || -1) - ((b.p && b.p.z) || -1);
    },

    _flipArgs: {
      "x":  [ -1,  1],
      "y":  [  1, -1],
      "xy": [ -1, -1]
    },

    // gets called by the Stage's render method (after all Stages' step methods have been called)
    // - so render of a Sprite is always called after the Sprite's step method (if one exists)
    render: function(ctx) {
      var p = this.p;

      if(p.hidden) { return; }
      if(!ctx) { ctx = Q.ctx; }

      this.trigger('predraw',ctx);

      ctx.save();

        if(this.p.opacity !== void 0 && this.p.opacity !== 1) {
          ctx.globalAlpha = this.p.opacity;
        }

        this.matrix.setContextTransform(ctx);

        if(this.p.flip) { ctx.scale.apply(ctx,this._flipArgs[this.p.flip]); }

        this.trigger('beforedraw',ctx);
        this.draw(ctx);
        this.trigger('draw',ctx);

      ctx.restore();
      
      // Children set up their own complete matrix
      // from the base stage matrix
      if(this.p.sort) { this.children.sort(this._sortChild); }
      Q._invoke(this.children,"render",ctx);
      
      this.trigger('postdraw',ctx);

      if(Q.debug & Q._DEBUG_RENDER_SPRITES_PINK) { this.debugRender(ctx); }

    },

    center: function() {
      if(this.container) {
        this.p.x = this.container.p.w / 2;
        this.p.y = this.container.p.h / 2;
      } else {
        this.p.x = Q.width / 2;
        this.p.y = Q.height / 2;
      }

    },

    draw: function(ctx) {
      var p = this.p;
      if(p.sheet) {
        console.assert(this.sheet(), "No sheet found in Q.sheets with the name of '"+p.sheet+"'! This is for Sprite '"+p.name+"'!");
        this.sheet().draw(ctx,-p.cx,-p.cy,p.frame);
      } else if(p.asset) {
        ctx.drawImage(Q.asset(p.asset),-p.cx,-p.cy);
      }
    },

    debugRender: function(ctx) {
      if(!this.p.points) {
        Q._generatePoints(this);
      }
      ctx.save();
      this.matrix.setContextTransform(ctx);
      ctx.beginPath();
      ctx.fillStyle = this.p.hit ? "blue" : "red";
      ctx.strokeStyle = "#FF0000";
      ctx.fillStyle = "rgba(0,0,0,0.5)";

      ctx.moveTo(this.p.points[0][0],this.p.points[0][1]);
      for(var i=0;i<this.p.points.length;i++) {
        ctx.lineTo(this.p.points[i][0],this.p.points[i][1]);
      }
      ctx.lineTo(this.p.points[0][0],this.p.points[0][1]);
      ctx.stroke();
      if(Q.debug & Q._DEBUG_RENDER_SPRITES_FILL) { ctx.fill(); }

      ctx.restore();

      if(this.c) { 
        var c = this.c;
        ctx.save();
          ctx.globalAlpha = 1;
          ctx.lineWidth = 1;
          ctx.strokeStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(c.x - c.cx,       c.y - c.cy);
          ctx.lineTo(c.x - c.cx + c.w, c.y - c.cy);
          ctx.lineTo(c.x - c.cx + c.w, c.y - c.cy + c.h);
          ctx.lineTo(c.x - c.cx      , c.y - c.cy + c.h);
          ctx.lineTo(c.x - c.cx,       c.y - c.cy);
          ctx.stroke();
        ctx.restore();
      }
    },

    // gets called by the Stage each GameLoop (step function in Stage object)
    // - if a step method is defined by the Sprite (doesn't have to be), gets called here
    // - only after that, the render method of the Sprite (all Sprites have one) is called
    update: function(dt) {
      this.trigger('prestep',dt);
      if(this.step) { this.step(dt); }
      this.trigger('step',dt);
      if (! (Q.debug & Q._DEBUG_RENDER_SPRITES_PINK)) this.refreshMatrix();

      // Ugly coupling to stage - workaround?
      if(this.stage && this.children.length > 0) {
        this.stage.updateSprites(this.children,dt,true);
      }
    },

    refreshMatrix: function() {
      var p = this.p;
      this.matrix.identity();

      if(this.container) { this.matrix.multiply(this.container.matrix); }
      
      this.matrix.translate(p.x,p.y);

      if(p.scale) { this.matrix.scale(p.scale,p.scale); }

      this.matrix.rotateDeg(p.angle);
    },

  });

  Q.Sprite.extend("MovingSprite",{
    init: function(props,defaultProps) {
      this._super(Q._extend({
        vx: 0,
        vy: 0,
        ax: 0,
        ay: 0,
        xmax: 9000,
        ymax: 9000,
      },props),defaultProps);
   },

   step: function(dt) {
     var p = this.p;

     p.vx += p.ax * dt;
     p.vy += p.ay * dt;

     p.x += p.vx * dt;
     p.y += p.vy * dt;
   },

   move: function(x, y) {
     var p = this.p;
     p.x += x;
     p.y += y;
     if (p.x < 0) { p.x = 0; p.vx = 0; }
     if (p.x > p.xmax) { p.x = p.xmax; p.vx = 0; }
     if (p.y < 0) { p.y = 0; p.vy = 0; }
     if (p.y > p.ymax) { p.y = p.ymax; p.vy = 0; }
   },
 });




  return Q;
};

