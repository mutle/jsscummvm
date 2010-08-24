(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM;

  s.setCameraAtEx = function(at) {
    var t = this, camera = t._camera;
    camera.mode = "normal";
    log("Moving camera to "+at);
    camera.cur.x = at;
    t.setCameraAt(at, 0);
    camera.movingToActor = false;
    t._fullRedraw = true;
  };

  s.setCameraAt = function(pos_x, pos_y) {
    var t = this, camera = t._camera;
    camera.dest.x = pos_x;
  };

  s.setCameraFollows = function(a, setCamera) {
    var t, i, camera = s._camera;
    if(!a) return;
    camera.mode = "follow_actor";
    camera.follows = a.number;

    if(!a.isInCurrentRoom()) {
      s.startScene(a.room, 0, 0);
      camera.mode = "follow_actor";
      camera.cur.x = a.pos.x;
      s.setCameraAt(camera.cur.x);
    }

    t = Math.floor(a.pos.x / 8) - s._screenStartStrip;

    if(t < camera.leftTrigger || t > camera.rightTrigger || setCamera == true)
      s.setCameraAt(a.pos.x, 0);

    for(j = 1; j < s._actors.length; j++) {
      if(s._actors[j].isInCurrentRoom()) {
        s._actors[j].needRedraw = true;
      }
    }
    // s.runInventoryScript(0);
  };

  s.moveCamera = function() {
    var t = this, camera = t._camera;
    t.cameraMoved();
  };

  s.cameraMoved = function() {
    var t = this, camera = t._camera, screenLeft = 0;

    if(camera.cur.x < (t._screenWidth / 2)) {
      camera.cur.x = Math.floor(t._screenWidth / 2);
    } else if(camera.cur.x > t._roomWidth - (t._screenWidth / 2)) {
      camera.cur.x = t._roomWidth - Math.floor(t._screenWidth / 2);
    }

    t._screenStartStrip = Math.floor(camera.cur.x / 8) - Math.floor(t._gdi.numStrips / 2);
    t._screenEndStrip = t._screenStartStrip + t._gdi.numStrips - 1;
    t._screenTop = 0;
    screenLeft = t._screenStartStrip * 8;
    t._virtscreens[0].xstart = screenLeft;
  };

  s.actorFollowCamera = function(act) {
    var camera = s._camera, old = camera.follows;
    s.setCameraFollows(act);
    if(camera.follows != old)
      ; // s.runInventoryScript(0);
    camera.movingToActor = false;
  }
}());
