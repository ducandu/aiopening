/*global Quintus:false */

Quintus["2D"] = function(Q) {

  Q.component('viewport',{
    added: function() {
      this.entity.on('prerender',this,'prerender');
      this.entity.on('render',this,'postrender');
      this.x = 0;
      this.y = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      this.centerX = Q.width/2;
      this.centerY = Q.height/2;
      this.scale = 1;
    },

    extend: {
      follow: function(sprite,directions,boundingBox,followMaxSpeed) {
        this.off('poststep',this.viewport,'follow');
        this.viewport.directions = directions || { x: true, y: true };
        this.viewport.following = sprite;
        this.viewport.boundingBox = boundingBox;
        this.viewport.followMaxSpeed = (followMaxSpeed || Infinity);
        this.on('poststep',this.viewport,'follow');
        this.viewport.follow((followMaxSpeed ? false : true));
      },

      unfollow: function() {
        this.off('poststep',this.viewport,'follow');
      },

      centerOn: function(x,y) {
        this.viewport.centerOn(x,y);
      },

      moveTo: function(x,y) {
        return this.viewport.moveTo(x,y);
      },

      shake: function() {
        setTimeout(function(vp) {vp.shakeY = 1;}, 30, this.viewport);
        setTimeout(function(vp) {vp.shakeY = -1;}, 60, this.viewport);
        setTimeout(function(vp) {vp.shakeY = 1;}, 90, this.viewport);
        setTimeout(function(vp) {vp.shakeY = -1;}, 120, this.viewport);
        setTimeout(function(vp) {vp.shakeY = 1;}, 150, this.viewport);
        setTimeout(function(vp) {vp.shakeY = -1;}, 180, this.viewport);
        setTimeout(function(vp) {vp.shakeY = 1;}, 210, this.viewport);
        setTimeout(function(vp) {vp.shakeY = 0;}, 240, this.viewport);
      },
    },

    follow: function(first) {
      var followX = Q._isFunction(this.directions.x) ? this.directions.x(this.following) : this.directions.x;
      var followY = Q._isFunction(this.directions.y) ? this.directions.y(this.following) : this.directions.y;

      this[first === true ? 'centerOn' : 'softCenterOn'](
                    followX ? 
                      this.following.p.x + this.following.p.w/2 - this.offsetX :
                      undefined,
                    followY ?
                     this.following.p.y + this.following.p.h/2 - this.offsetY :
                     undefined
                  );
    },

    offset: function(x,y) {
      this.offsetX = x;
      this.offsetY = y;
    },

    softCenterOn: function(x,y) {
      if(x !== void 0) {        
        var dx = (x - Q.width / 2 / this.scale - this.x)/3;//, this.followMaxSpeed);
        if (Math.abs(dx) > this.followMaxSpeed)
          dx = this.followMaxSpeed * (dx < 0 ? -1 : 1);
        if(this.boundingBox) {
          if(this.x + dx < this.boundingBox.minX) {
            this.x = this.boundingBox.minX / this.scale;
          }
          else if(this.x + dx > (this.boundingBox.maxX - Q.width) / this.scale) {
            this.x = (this.boundingBox.maxX - Q.width) / this.scale;
          }
          else {
            this.x += dx;
          }            
        }
        else {
          this.x += dx;
        }
      }
      if(y !== void 0) { 
        var dy = (y - Q.height / 2 / this.scale - this.y)/3;
        if (Math.abs(dy) > this.followMaxSpeed)
          dy = this.followMaxSpeed * (dy < 0 ? -1 : 1);
        if(this.boundingBox) {
          if(this.y + dy < this.boundingBox.minY) {
            this.y = this.boundingBox.minY / this.scale;
          }
          else if(this.y + dy > (this.boundingBox.maxY - Q.height) / this.scale) {
            this.y = (this.boundingBox.maxY - Q.height) / this.scale;
          }
          else {
            this.y += dy;
          }
        }
        else {
          this.y += dy;
        }
      }
    },
    centerOn: function(x,y) {
      if(x !== void 0) {
        this.x = x - Q.width / 2 / this.scale;
      }
      if(y !== void 0) { 
        this.y = y - Q.height / 2 / this.scale;
      }

    },

    moveTo: function(x,y) {
      if(x !== void 0) {
        this.x = x;
      }
      if(y !== void 0) { 
        this.y = y;
      }
      return this.entity;

    },

    prerender: function() {
      this.centerX = this.shakeX + this.x + Q.width / 2 /this.scale;
      this.centerY = this.shakeY + this.y + Q.height / 2 /this.scale;
      Q.ctx.save();
      Q.ctx.translate(Math.floor(Q.width/2),Math.floor(Q.height/2));
      Q.ctx.scale(this.scale,this.scale);
      Q.ctx.translate(-Math.floor(this.centerX), -Math.floor(this.centerY));
    },

    postrender: function() {
      Q.ctx.restore();
    }
  });

 // Svennie:
 // a tmx file object (stores the sheets (possibly more than one; including sheets' tile properties)
 //  and the map data (possibly more than one tile-layer))
 // - problem was that Quintus did not support tsx files, nor tile-properties, nor multiple tilesets (sheets) within the same map (tmx)
 Q.TmxFile = Q.Class.extend({
    init: function (p) {
        if (Q._isString(p)) p = { tmxFile: p };
        this.p = p;
        Q._defaults(p, {
           tmxFile: "strt.tmx",
           tilePropsByGID: {},
           sheets: {}, // <tileset>s by name
           firstgid: [], // array sorted by firstgid (lowest first); values=arrays:[sheet-name, firstgid]
           layers: {}, // <layer>s by layerName
           objectgroups: {}, // <objectgroup>s by objectgroup-name
        });
        console.assert(Q.asset(p.tmxFile), "No asset ("+p.tmxFile+") loaded yet in TmxFile c'tor!");
        this.load(p.tmxFile);
    },

    // parses the entire tmx file data into a practical structure
    load: function (tmxFile) {
        console.assert(Q.asset(tmxFile), "No asset ("+tmxFile+") loaded yet in TmxFile.load method!");
        var parser = new DOMParser(),
          doc = parser.parseFromString(Q.asset(tmxFile), "application/xml"),
          p = this.p;

        // the map attributes
        var map = doc.getElementsByTagName("map")[0];
        p.w = parseInt(map.getAttribute("width"));
        p.h = parseInt(map.getAttribute("height"));
        p.tileW = parseInt(map.getAttribute("tilewidth"));
        p.tileH = parseInt(map.getAttribute("tileheight"));

        // the tilesets (sheets)
        var tilesets = map.getElementsByTagName("tileset");
        for(var x = 0; x < tilesets.length; ++x) {
          var tileset = tilesets[x],
              firstgid = parseInt(tileset.getAttribute("firstgid")),
              source = tileset.getAttribute("source"),
              tsx = false,
              name = "";
          if (source) { // from tsx file
             name = source.replace(/^.+\//, "").replace(/\.\w+$/, "");
             tsx = source;
          }
          else { // from tmx file (=read tileset tag)
              name = tileset.getAttribute("name");
              tsx = tileset;
          }
          var sheet = Q.sheet(name);
          if (! sheet) { // if sheet already exists, do nothing
              sheet = Q.sheet(name, 0, {fromTsx: tsx});
          }
          // add sheet to sheets-list
          p.sheets[name] = sheet;
          console.assert(p.firstgid.length == 0 || p.firstgid[p.firstgid.length-1][1] < firstgid, "Tilesets in tmx file "+tmxFile+" are not sorted by firstgid (lowest first)!");
          p.firstgid.push([name, firstgid]); // important for interpreting the map

          // store tile properties already mapped by gid,
          // so we don't have to do this everytime in step or collision methods
          var tilePropsByID = sheet.tilePropsByID;
          for (var id in tilePropsByID) {
              p.tilePropsByGID[parseInt(id)+firstgid] = tilePropsByID[id];
          }
        }

        // the tilelayers (store in row/col matrix, not(!) as list as in xml file)
        var tilelayers = map.getElementsByTagName("layer");
        for(var layerIndex = 0; layerIndex < tilelayers.length; ++layerIndex) {
          var data = [],
              idx = 0;
          var layer = tilelayers[layerIndex];
          console.assert(parseInt(layer.getAttribute("width")) == p.w, "Layer attribute width ("+parseInt(layer.getAttribute("width"))+") not the same as map's width ("+p.w+")!");
          console.assert(parseInt(layer.getAttribute("height")) == p.h, "Layer attribute height ("+parseInt(layer.getAttribute("height"))+") not the same as map's height ("+p.h+")!");
          var layerName = layer.getAttribute("name");
          var tiles = layer.getElementsByTagName("data")[0].getElementsByTagName("tile");
          for (var y = 0; y < p.h; ++y) {
             data[y] = [];
             for (var x = 0; x < p.w; ++x) {
               var tile = tiles[idx];
               data[y].push(parseInt(tile.getAttribute("gid")));
               idx++;
             }
          }
          // add layer to layers-list
          p.layers[layerName] = data;
        }

        // the objectgroups
        var objectgroups = map.getElementsByTagName("objectgroup");
        for(var groupIndex = 0; groupIndex < objectgroups.length; ++groupIndex) {
          var objectList = [];
          //    idx = 0;
          var group = objectgroups[groupIndex];
          console.assert(parseInt(group.getAttribute("width")) == p.w, "Objectgroup attribute width ("+parseInt(group.getAttribute("width"))+") not the same as map's width ("+p.w+")!");
          console.assert(parseInt(group.getAttribute("height")) == p.h, "Objectgroup attribute height ("+parseInt(group.getAttribute("height"))+") not the same as map's height ("+p.h+")!");
          var groupName = group.getAttribute("name");
          var objects = group.getElementsByTagName("object");
          for (var objIndex = 0; objIndex < objects.length; ++objIndex) {
              // x, y, gid
              var o = objects[objIndex],
                  obj = { x: parseInt(o.getAttribute("x")), y: parseInt(o.getAttribute("y")) };
                  gid = parseInt(o.getAttribute("gid"));
              console.assert(gid, "No gid given for object #"+objIndex+" in "+p.tmxFile+". Objects w/o gid not supported yet!");
              // get tile-props from gid
              //var sheet = this.sheet(gid),
              //    gidoffset = this.gidOffset(gid),
              //    id = gid - gidoffset;
              if (p.tilePropsByGID[gid]) {
                  for (var name in p.tilePropsByGID[gid])
                      obj[name] = p.tilePropsByGID[gid][name];
              }
              // ... other manual properties
              var manualpropgroup = o.getElementsByTagName("properties")[0];
              if (manualpropgroup) {
                  var manualprops = manualpropgroup.getElementsByTagName("property");
                  for (var x = 0, l = manualprops.length; x < l; ++x) {
                      var val = manualprops[x].getAttribute("value");
                      var floatval = parseFloat(val);
                      obj[manualprops[x].getAttribute("name")] = (isNaN(floatval) ? val : floatval);
                  }
              }
              objectList.push(obj);
          }
          // add objectgroup to objectgroups-list
          p.objectgroups[groupName] = objectList;
        }
    },

    // picks the correct sheet given the gid of a tile and returns it (as SpriteSheet object)
    // - tmx files can have more than one sheet
    sheet: function(gid) {
       var list = this.p.firstgid;
           //name = list[list.length-1][0];
       for (var x = 1, l = list.length; x < l; ++x) {
          if (list[x][1] > gid) {
             return this.p.sheets[list[x-1][0]]; // return previous sheet
          }
       }
       return this.p.sheets[list[list.length-1][0]]; // return last possible sheet
    },

    // returns the correct gid_offset for a given gid to make it work with the gid's sheet
    gidOffset: function(gid) {
       var list = this.p.firstgid;
           //gid_offset = 0;
       for (var x = 1, l = list.length; x < l; ++x) {
          if (list[x][1] > gid) {
             return list[x-1][1];
          }
       }
       return list[list.length-1][1];
    },


 });
 // END: Svennie


 Q.TileLayer = Q.Sprite.extend({
    init: function(props) {
      this._super(props,{
        blockTileW: 10, // what for ???
        blockTileH: 10,
        type: Q._SPRITE_DEFAULT, // make it a collision-layer by default
        layerName: "collision",
        tmxObj: false,
        sheet: "fakesheet", // fake sheet (doesn't exist as SpriteSheet-object) to make Sprite class believe it has a valid sheet
        render: true, // set to false, if tileLayer should be there, but not rendered
        	//TODO: change to 'hidden' since 'render' is already the parent (Sprite) method to draw the sprite (not used by TileLayers, but still)
      });
      var p = this.p, tmxObj = p.tmxObj;
      console.assert(tmxObj, "No tmxObj given in TileLayer c'tor!");

      p.tileW = tmxObj.p.tileW;
      p.tileH = tmxObj.p.tileH;
      p.tiles = tmxObj.p.layers[p.layerName];
      console.assert(p.tiles, "No layer with the name of '"+p.layerName+"' found in tmxObj '"+tmxObj.p.tmxFile+"'!");
      p.tilePropsByGID = tmxObj.p.tilePropsByGID; // link for simplicity
      p.tileFlags = {}; // hash where we can "flag" tile positions (x:y) for already being analyzed for collisions
                        // can be reset by calling this.resetTileFlags();
      p.cols = tmxObj.p.w; //in tile units
      p.rows = tmxObj.p.h;
      p.w = p.cols * p.tileW; // in px
      p.h = p.rows * p.tileH;
      this.blocks = [];
      p.blockW = p.tileW * p.blockTileW;
      p.blockH = p.tileH * p.blockTileH;
      this.colBounds = {}; 
      this.directions = [ 'top','left','right','bottom'];

      // represents a single tile from the layer
      // - can be populated with x/y coordinates (depending on the tile position) and fed to the Q.collision function for collision checks on single tiles
      this.collisionObject = {
        p: {
          w: p.tileW,
          h: p.tileH,
          cx: p.tileW/2,
          cy: p.tileH/2
        }
      };
      this.collisionNormal = { separate: []};
    },

    getTile: function(tileX,tileY) {
      return this.p.tiles[tileY] && this.p.tiles[tileY][tileX];
    },

    setTile: function(x,y,tile) {
      var p = this.p,
          blockX = Math.floor(x/p.blockTileW),
          blockY = Math.floor(y/p.blockTileH);

      if(blockX >= 0 && blockY >= 0 && blockX < this.p.cols && blockY <  this.p.cols) {
        this.p.tiles[y][x] = tile;
        if(this.blocks[blockY]) {
          this.blocks[blockY][blockX] = null;
        }
      }
    },

    tilePresent: function(tileX,tileY) {
      return this.p.tiles[tileY] && this.collidableTile(this.p.tiles[tileY][tileX]);
    },

    // Override this method to draw tiles at frame 0 or not draw
    // tiles at higher number frames
    drawableTile: function(tileNum) {
      return (this.p.render && tileNum > 0);
    },

    // Override this method to control which tiles trigger a collision
    // (defaults to all tiles > number 0)
    collidableTile: function(tileNum) {
      return tileNum > 0;
    },

    resetTileFlags: function() {
        for (var tilepos in this.p.tileFlags)
           delete this.p.tileFlags[tilepos];
    },

    collide: function(obj) {
      var p = this.p,
          objp = (obj.p || Q._EMPTY_OBJ),
          tileStartX = Math.floor((obj.p.x - obj.p.cx - p.x) / p.tileW),
          tileStartY = Math.floor((obj.p.y - obj.p.cy - p.y) / p.tileH),
          tileEndX =  Math.ceil((obj.p.x - obj.p.cx + obj.p.w - p.x) / p.tileW),
          tileEndY =  Math.ceil((obj.p.y - obj.p.cy + obj.p.h - p.y) / p.tileH),
          colObj = this.collisionObject,
          normal = this.collisionNormal,
          col;
  
      normal.collided = false;

      // - slope handling takes place here
      //   - slope-handling: pick that tile for the collision that has to deal with shifting the y-pos of the character up
      //     (which means, if we find a collision with a slope-2-offset-1-tile and the character is already touching the next tile with its right-x-corner, we pick the next tile (if it's also a slope 2, etc...)
      // - pick the first collision and return it
      // - make sure each tile is only checked once for collisions (use tileFlags hash to tag tiles as "already processed")
      // TODO: make sure it works with generic obj and tile sizes (e.g. enemies bigger than the vikings, e.g. 64x64)
      // - the order of the tiles we loop through is bottom-up and in direction of characters running direction (objp.vx)
      var ystrt = tileEndY,yend = tileStartY,yincr = -1,xstrt,xend,xincr;
      if (obj.p.vx >= 0 /*running right*/) {
          xstrt = tileStartX;
          xend = tileEndX;
          xincr = 1;
      }
      else {
          xstrt = tileEndX;
          xend = tileStartX;
          xincr = -1;
      }

      yloop:
      for(var tileY = ystrt; (yincr == 1 ? tileY <= yend : tileY >= yend); tileY += yincr) {
        for(var tileX = xstrt; (xincr == 1 ? tileX <= xend : tileX >= xend); tileX += xincr) {
          if (p.tileFlags[tileX+":"+tileY]) continue;
          p.tileFlags[tileX+":"+tileY] = 1; // flag this tile as "already processed"

          if(this.tilePresent(tileX,tileY)) {
            colObj.p.x = tileX * p.tileW + p.x + p.tileW/2;
            colObj.p.y = tileY * p.tileH + p.y + p.tileH/2;


			// TODO: exclude collisions such as: where Nx=-1 with tiles that have a left x-neighbor (impossible!), OR where Nx=1 with a right x-neighbor, etc..
			//       those collisions could cause a running character to get x-stuck in a floor-tile (and then play "push"-animation instead of "run"-animation)


            // we got a new collision with this (non-flagged) tile
            if ((col = Q.collision(obj, colObj)) && col.magnitude > 0) {
            // && ((obj.p.vx == 0 && obj.p.vy == 0) || (obj.p.vx != 0 && col.normalX != 0) || (obj.p.vy != 0 && col.normalY != 0))) {
              var tile = this.getTile(tileX,tileY);
              var tileprops = (p.tilePropsByGID ? (p.tilePropsByGID[tile] || Q._EMPTY_OBJ) : Q._EMPTY_OBJ);

              // check for slopes
              normal.slope = false;
              if (objp.onGround) {
                  // up-slope or down-slope?
                  var slope = parseInt(tileprops["slope"] || 0); // -3, -2, -1, 1, 2, 3: negative=down, positive=up (1==45 degree slope, 3=11 degree slope)
                  if (slope != 0) {
                      var sl = (slope > 0 ? 1 : -1);
                      var xedge = objp.x + (objp.cx * sl); // up-slope: right x-edge of sprite; down-slope: left x-edge of sprite
                      var xtile = (tileX+(sl == 1 ? 0 : 1)) * p.tileW; // up-slope: left x-edge of tile; down-slope: right x-edge of tile
                      var xin = (xedge - xtile)*sl;
                      // get the properties of the next x-tile (if this tile is up-slope: next-tile=x+1, if this tile is down-slope: next-tile=x-1)
                      var nextxtileprops = (p.tilePropsByGID ? (p.tilePropsByGID[this.getTile(tileX+sl,tileY)] || Q._EMPTY_OBJ) : Q._EMPTY_OBJ);
                      var nextxtileslope = (nextxtileprops["slope"] || 0);
                      // only count as collision, if xedge of object is actually inside this tile (not already touching the next tile)
                      // or if next x-tile is NOT the same slope sign as this tile's slope (e.g. slopedown-straight, slopeup-slopedown, slopeup-straight, etc..)
                      if (xin > p.tileW && (nextxtileslope?nextxtileslope<0?-1:1:0) == sl) {
                          continue;
                      }
                      // store slope specifics so we don't have to pull and calc it all again in object's collision handler
                      normal.slope = slope;
                      normal.sl = sl;
                      normal.xin = (xin > p.tileW ? p.tileW : xin);
                  }
              }

              normal.collided = true;
              normal.separate[0] = col.separate[0];
              normal.separate[1] = col.separate[1];
              normal.magnitude = col.magnitude;
              normal.distance = col.distance;
              normal.normalX = col.normalX;
              normal.normalY = col.normalY;
              normal.tileX = tileX;
              normal.tileY = tileY;
              normal.tile = tile;
              normal.tileprops = tileprops;

              break yloop; // return first tile that gives us a collision
            }
          }
        }
      }
      return normal.collided ? normal : false;
    },

    prerenderBlock: function(blockX,blockY) {
      var p = this.p,
          tiles = p.tiles,
          blockOffsetX = blockX*p.blockTileW,
          blockOffsetY = blockY*p.blockTileH;

      if(blockOffsetX < 0 || blockOffsetX >= this.p.cols ||
         blockOffsetY < 0 || blockOffsetY >= this.p.rows) {
           return;
      }

      var canvas = document.createElement('canvas'),
          ctx = canvas.getContext('2d');

      canvas.width = p.blockW;
      canvas.height= p.blockH;
      this.blocks[blockY] = this.blocks[blockY] || {};
      this.blocks[blockY][blockX] = canvas;

      for(var y=0;y<p.blockTileH;y++) {
        if(tiles[y+blockOffsetY]) {
          for(var x=0;x<p.blockTileW;x++) {
            if(this.drawableTile(tiles[y+blockOffsetY][x+blockOffsetX])) {
              var gid = tiles[y+blockOffsetY][x+blockOffsetX],
                  sheet = this.p.tmxObj.sheet(gid),
                  gid_offset = this.p.tmxObj.gidOffset(gid);
              sheet.draw(ctx, x*p.tileW, y*p.tileH, gid - gid_offset);
            }
          }
        }
      }
    },

    drawBlock: function(ctx, blockX, blockY) {
      var p = this.p,
          startX = Math.floor(blockX * p.blockW + p.x),
          startY = Math.floor(blockY * p.blockH + p.y);

      if(!this.blocks[blockY] || !this.blocks[blockY][blockX]) {
        this.prerenderBlock(blockX,blockY);
      }

      if(this.blocks[blockY]  && this.blocks[blockY][blockX]) {
        ctx.drawImage(this.blocks[blockY][blockX],startX,startY);
      }
    },

    draw: function(ctx) {
      //if (this.p.render == false) return;
      var p = this.p,
          viewport = this.stage.viewport,
          scale = viewport ? viewport.scale : 1,
          x = viewport ? viewport.x : 0,
          y = viewport ? viewport.y : 0,
          viewW = Q.width / scale,
          viewH = Q.height / scale,
          startBlockX = Math.floor((x - p.x) / p.blockW),
          startBlockY = Math.floor((y - p.y) / p.blockH),
          endBlockX = Math.floor((x + viewW - p.x) / p.blockW),
          endBlockY = Math.floor((y + viewH - p.y) / p.blockH);

      for(var iy=startBlockY;iy<=endBlockY;iy++) {
        for(var ix=startBlockX;ix<=endBlockX;ix++) {
          this.drawBlock(ctx,ix,iy);
        }
      }
    }
  });

  Q.gravityY = 9.8*100;
  Q.gravityX = 0;

  Q.component('2d',{
    added: function() {
      var entity = this.entity;
      Q._defaults(entity.p,{
        vx: 0,
        vy: 0,
        ax: 0,
        ay: 0,
        gravity: 1,
        collisionMask: Q._SPRITE_DEFAULT
      });
      entity.on('step',this,"step");
      entity.on('hit',this,'collision');
    },

    collision: function(col,last) {
      var entity = this.entity,
          p = entity.p,
          magnitude = 0;

      if(col.obj.p && col.obj.p.sensor) {
        col.obj.trigger("sensor",entity);
        return;
      }

      col.impact = 0;
      var impactX = Math.abs(p.vx);
      var impactY = Math.abs(p.vy);

      p.x -= col.separate[0];
      p.y -= col.separate[1];

      // Top collision
      if(col.normalY < -0.3) { 
        if(p.vy > 0) { p.vy = 0; }
        col.impact = impactY;
        entity.trigger("bump.bottom",col);
      }
      if(col.normalY > 0.3) {
        if(p.vy < 0) { p.vy = 0; }
        col.impact = impactY;

        entity.trigger("bump.top",col);
      }

      if(col.normalX < -0.3) { 
        if(p.vx > 0) { p.vx = 0;  }
        col.impact = impactX;
        entity.trigger("bump.right",col);
      }
      if(col.normalX > 0.3) { 
        if(p.vx < 0) { p.vx = 0; }
        col.impact = impactX;

        entity.trigger("bump.left",col);
      }
    },

    step: function(dt) {
		//console.log("inside 2d step");
      var p = this.entity.p,
          dtStep = dt;
      // TODO: check the entity's magnitude of vx and vy,
      // reduce the max dtStep if necessary to prevent 
      // skipping through objects.
      while(dtStep > 0) {
        dt = Math.min(1/30,dtStep);
        // Updated based on the velocity and acceleration
        p.vx += p.ax * dt + (p.gravityX == void 0 ? Q.gravityX : p.gravityX) * dt * p.gravity;
        p.vy += p.ay * dt + (p.gravityY == void 0 ? Q.gravityY : p.gravityY) * dt * p.gravity;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        this.entity.stage.collide(this.entity);
        dtStep -= dt;
      }
    }
  });

  Q.component('aiBounce', {
    added: function() {
      this.entity.on("bump.right",this,"goLeft");
      this.entity.on("bump.left",this,"goRight");
    },

    goLeft: function(col) {
      this.entity.p.vx = -col.impact;      
      if(this.entity.p.defaultDirection == 'right') {
          this.entity.p.flip = 'x';
      }
      else {
          this.entity.p.flip = false;
      }
    },

    goRight: function(col) {
      this.entity.p.vx = col.impact;
      if(this.entity.p.defaultDirection == 'left') {
          this.entity.p.flip = 'x';
      }
      else {
          this.entity.p.flip = false;
      }
    }
  });

};

