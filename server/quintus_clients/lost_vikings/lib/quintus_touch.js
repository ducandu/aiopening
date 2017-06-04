/*global Quintus:false */

Quintus.Touch = function(Q) {
  if(Q._isUndefined(Quintus.Sprites)) {
    throw "Quintus.Touch requires Quintus.Sprites Module";
  }

  var hasTouch =  !!('ontouchstart' in window);

  var touchStage = [0];
  var touchType = 0;
  var touchRegister = []; // allows to register more complex (but also simple) touch events on either objects OR the quintus canvas
                          // - events could be: touch, drag, touchEnd, tap, swipe, swipeUp, swipeDown, pinch, etc..
                          // - the touchRegister can be set by calling Q.touch() with a third parameter, which is an array of objects
                          //   where the objects have: event=e.g. "tap", obj=obj ref (special object), true (all objects) or false (quintus canvas)

  Q.Evented.extend("TouchSystem",{

    init: function() {
      var touchSystem = this;

      this.boundTouch = function(e) { touchSystem.touch(e); };
      this.boundDrag = function(e) { touchSystem.drag(e); };
      this.boundEnd = function(e) { touchSystem.touchEnd(e); };

      Q.el.addEventListener('touchstart',this.boundTouch);
      Q.el.addEventListener('mousedown',this.boundTouch);

      Q.el.addEventListener('touchmove',this.boundDrag);
      Q.el.addEventListener('mousemove',this.boundDrag);

      Q.el.addEventListener('touchend',this.boundEnd);
      Q.el.addEventListener('mouseup',this.boundEnd);
      Q.el.addEventListener('touchcancel',this.boundEnd);

      this.touchPos = new Q.Evented();
      this.touchPos.grid = {};
      this.touchPos.p = { w:1, h:1, cx: 0, cy: 0 };
      this.activeTouches = {}; // key=touch IDs
      this.touchedObjects = {}; // key=object (e.g. Sprite) that's currently touched, OR 'false' for the quintus canvas
      this.touchHistory = []; // logs n levels deep the history of all touch events (0=first touch event, 1=next one, ...); clean up occasionally
                              // - used to create complex touch events such as "tap", "swipeUp", etc..
    },

    destroy: function() {
      Q.el.removeEventListener('touchstart',this.boundTouch);
      Q.el.removeEventListener('mousedown',this.boundTouch);

      Q.el.removeEventListener('touchmove',this.boundDrag);
      Q.el.removeEventListener('mousemove',this.boundDrag);

      Q.el.removeEventListener('touchend',this.boundEnd);
      Q.el.removeEventListener('mouseup',this.boundEnd);
      Q.el.removeEventListener('touchcancel',this.boundEnd);
    },

    touch: function(e) {
      var touches = e.changedTouches || [ e ];

      for(var i = 0; i < touches.length; ++i) {

        for(var stageIdx = 0; stageIdx < touchStage.length; ++stageIdx) {
          var touch = touches[i],
              stage = Q.stage(touchStage[stageIdx]);

          if(!stage) { continue; }

          touch.identifier = touch.identifier || 0;
          var pos = this.normalizeTouch(touch, stage);

          stage.regrid(pos,true);
          var col = stage.search(pos, touchType), obj;

          if(col || stageIdx === touchStage.length - 1) {
            obj = col && col.obj;
            pos.obj = obj;
            //this.trigger("touch", pos);
          }

          var key = obj || Q.touchInput;// || "_quintus";
          if(!this.touchedObjects[key]) {
          //if(obj && !this.touchedObjects[obj]) {
            var active = this.activeTouches[touch.identifier] = {
              // normalized positions
              x: pos.p.px,
              y: pos.p.py,
              // not normalized positions
              sx: pos.p.ox, // start position
              sy: pos.p.oy,
              st: Date.now(), // start timestamp
              lx: pos.p.ox, // last logged position (for drags, only log drags when a certain speed or distance are passed)
              ly: pos.p.oy,
              identifier: touch.identifier,
              obj: key,
              stage: stage,
            };
            active.lt = active.st; // last logged timestamp

            this.touchedObjects[key] = true;
            this.touchHistory.push({event: "touch", id: touch.identifier, obj: key, x: active.x, y: active.y, timestamp: active.lt});

            if (obj) {
              active.origX = obj.p.x;
              active.origY = obj.p.y;
              break; // break once we find an object
            }
          }
        }
      }

      this.findRegisteredEvents();
      //e.preventDefault();
    },

    drag: function(e) {
      var touches = e.changedTouches || [ e ],
          real_drag = false;
      for(var i=0;i<touches.length;i++) {
        var touch = touches[i];
        touch.identifier = touch.identifier || 0;

        var active = this.activeTouches[touch.identifier],
            stage = active && active.stage;

        if(active) {
          var pos = this.normalizeTouch(touch,stage);

          // check whether this drag should be counted
          // - only count drags that go over a certain distance OR with a certain speed
          var dist = Math.pow(Math.pow(pos.p.ox - active.lx, 2)+Math.pow(pos.p.oy - active.ly, 2), 0.5),
              time = Date.now(),
              speed = dist/(time-active.lt);
          if (dist >= 20 || speed >= 0.9) { // we have a real drag event
            real_drag = true;
            active.x = pos.p.px;
            active.y = pos.p.py;
            active.dx = pos.p.ox - active.lx; // dx gives the diff to the last logged drag
            active.dy = pos.p.oy - active.ly;
            active.lx = pos.p.ox; // store the current x/y positions as the "last logged ones"
            active.ly = pos.p.oy;
            active.lt = time;
            this.touchHistory.push({event: "drag", id: active.identifier, obj: active.obj, x: active.x, y: active.y, dx: active.dx, dy: active.dy, timestamp: time});
          }
        }
      }
      if (real_drag) this.findRegisteredEvents();
      e.preventDefault();
    },

    touchEnd: function(e) {
      var touches = e.changedTouches || [ e ];

      for(var i=0;i<touches.length;i++) {
        var touch = touches[i];

        touch.identifier = touch.identifier || 0;

        var active = this.activeTouches[touch.identifier];

        if(active) {
          delete this.touchedObjects[active.obj];
          this.activeTouches[touch.identifier] = null;
          this.touchHistory.push({event: "end", id: active.identifier, obj: active.obj, timestamp: Date.now()});
        }
      }
      this.findRegisteredEvents();
      e.preventDefault();
    },

    normalizeTouch: function(touch,stage) {
      var canvasPosX = touch.offsetX,
          canvasPosY = touch.offsetY;
         

      if(Q._isUndefined(canvasPosX) || Q._isUndefined(canvasPosY)) {
        canvasPosX = touch.layerX;
        canvasPosY = touch.layerY;
      }

      if(Q._isUndefined(canvasPosX) || Q._isUndefined(canvasPosY)) {
        if(Q.touch.offsetX === void 0) {
          Q.touch.offsetX = 0;
          Q.touch.offsetY = 0;
          var el = Q.el;
          do {
            Q.touch.offsetX += el.offsetLeft;
            Q.touch.offsetY += el.offsetTop;
          } while(el = el.offsetParent);
        }
        canvasPosX = touch.pageX - Q.touch.offsetX;
        canvasPosY = touch.pageY - Q.touch.offsetY;
      }


      this.touchPos.p.ox = this.touchPos.p.px = canvasPosX / Q.cssWidth * Q.width;
      this.touchPos.p.oy = this.touchPos.p.py = canvasPosY / Q.cssHeight * Q.height;
      
      if(stage.viewport) {
        this.touchPos.p.px /= stage.viewport.scale;
        this.touchPos.p.py /= stage.viewport.scale;
        this.touchPos.p.px += stage.viewport.x;
        this.touchPos.p.py += stage.viewport.y;
      }

      this.touchPos.p.x = this.touchPos.p.px;
      this.touchPos.p.y = this.touchPos.p.py;

      this.touchPos.obj = null;
      return this.touchPos;
    },

    // looks in the history of touch events and tries to find registered events in there, then triggers them
    // - events can be registered through calling Q.touch() with the third parameter being an array of register objects:
    //   e.g. {event: "[touch, drag, or end]", obj: [true (for all objects), false for canvas, or some actual obj ref]}
    findRegisteredEvents: function() {
        for (var x = 0, l = touchRegister.length; x < l; ++x) {
            var reg = touchRegister[x],
                func = "find"+reg.event.charAt(0).toUpperCase()+reg.event.slice(1);
            if (this[func]) {
                var erase_up_to = this[func](reg.obj);
                if (erase_up_to != false) this.touchHistory.splice(0, erase_up_to); // clean up the history array up to the last detected event
            }
        }
    },

    // finds a tap event within the touch-history list
    // - a tap is a touch on objX shortly followed by touchEnd on objX (no drag in the middle!)
    // - searchObj can be: 'undefined' or 'false' for quintus canvas, 'true' for any object, or an object ref for a certain object
    findTap: function(searchObj) {
        var last = this.touchHistory[this.touchHistory.length-1];
        if (last.event != "end") return false;
        if (!this._touchMatch(searchObj, last.obj)) return false;
        // find tap: find the touch event that came before the touchEnd (on the same obj)
        for (var x = this.touchHistory.length-2; x >= 0; --x) {
            var touch = this.touchHistory[x];
            if (this._touchMatch(searchObj, touch.obj)) {
                if (touch.event == "touch" && last.timestamp - touch.timestamp <= 500) { // here it is -> trigger tap-event and return non-false
                    touch.obj.trigger("tap", touch);
                    return x;
                }
                else return false; // if we find any event other than 'touch' on this object -> return (must be some swipe)
            }
        }
    },

    // finds a swipe event within the touch-history list
    // - a swipe is a touch on objX followed by a couple of drags all in the same direction, followed by an end
    findSwipe: function(searchObj) {
        var last = this.touchHistory[this.touchHistory.length-1];
        if (last.event != "end") return false;
        if (!this._touchMatch(searchObj, last.obj)) return false;
        // find swipe: find the drag and touch events that came before the touchEnd (on the same obj)
        var drag_direction = 0;
        for (var x = this.touchHistory.length-2; x >= 0; --x) {
            var touch = this.touchHistory[x];
            if (this._touchMatch(searchObj, touch.obj)) {
                if (touch.event == "drag") {
                  var this_direction = this._dragDirection(touch);
                  if (! drag_direction) drag_direction = this_direction;
                  else if (drag_direction != this_direction) return false;
                }
                else if (drag_direction && touch.event == "touch") {
                  touch.obj.trigger("swipe", [touch, drag_direction]);
                  return x;
                }
                else return false;
            }
        }
    },

    _touchMatch: function(searchObj, isObj) {
        if (searchObj == true) { // any object will do (except the canvas!)
            return (Q._isObject(isObj) && isObj !== Q.touchInput);
        }
        else if (! searchObj) { // canvas
            return ((!isObj) || isObj === Q.touchInput);
        }
        else return searchObj === isObj;
    },

    _dragDirection: function(touch) {
        if (Math.abs(touch.dx) > Math.abs(touch.dy)) {
          if (touch.dx > 0) return "right";
          return "left";
        }
        else if (touch.dy > 0) return "down";
        return "up";
    },

  });


  Q.touch = function(type, stage, register) {
    Q.untouch();
    // type are actually the options
    if (Q._isObject(type)) {
        touchType = type.type;
        touchStage = type.stage;
        touchRegister = type.register;
    }
    else {
        touchType = type;
        touchStage = stage;
        touchRegister = register;
    }
    touchType = touchType || Q._SPRITE_UI;
    touchStage = touchStage || [2,1,0];
    touchRegister = touchRegister || [{event: "tap", obj: true}, {event: "swipe"}]; // by default, only look for and trigger (1) tap on objects and (2) swipe on the canvas (e.g. for player control)
    if(!Q._isArray(touchStage)) {
      touchStage = [touchStage];
    }

    if(! Q.touchInput) {
      Q.touchInput = new Q.TouchSystem();
    }
    return Q;
  };

  Q.untouch = function() {
    if(Q.touchInput) {
      Q.touchInput.destroy();
      delete Q['touchInput'];
    }
    return Q;
  };

};
