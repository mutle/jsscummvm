(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM;

  s.Actor = function(id) {
    var t = this;

    t.number = id;
    t.pos = _system.Point(0, 0);
    t.room = 0;

    t.initActor = function(mode) {
    };

    t.isInCurrentRoom = function() {
      return t.room == s._currentRoom;
    };
    t.drawActorCostume = function(hitTestMode) {
    };

    t.initActor(-1);
  };

  s.CostumeLoader = function() {
    var t = this;
    t.baseptr = null;
    t.animCmds = [];
    t.dataOffsets = [];
    t.palette = [];
    t.frameOffsets = [];
    t.numColors = 0;
    t.numAnim = 0;
    t.format = 0;
    t.mirror = false

    t.loadCostume = function(id) {
    };
    t.costumeDecodeData = function(actor, frame, usemask) {
    };
    t.hasManyDirections = function(id) {
      return false;
    };
  };

  s.CostumeRenderer = function() {
    var t = this;
    t.loader = new s.CostumeLoader();

    t.setPalette = function(palette) {
    };
    t.setFacing = function(actor) {
    };
    t.setCostume = function(costume, shadow) {
    };
    t.drawCostume = function(vs, numStrips, a, drawToBackBuf) {
    };

    t.mainRoutine = function(xmoveCur, ymoveCur) {
    };

  };

  s.processActors = function() {
    var t = this, i, numactors = 0;
    for(i = 1; i < t._nums['actors']; i++) {
      if(t._actors[i] && t._actors[i].isInCurrentRoom()) {
        t._sortedActors[numactors++] = t._actors[i];
      }
    }
    if(!numactors) return;
  };

}());
