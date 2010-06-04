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
}());
