(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM;

  s.RoomHeader = function(stream) {
    var t = this;
    t.width = 0; t.height = 0; t.numObjects = 0;
    t.stream = stream;
    if(t.stream) {
      log(stream.offset);
      t.width = t.stream.readUI16();
      t.height = t.stream.readUI16();
      t.numObjects = t.stream.readUI16();
    }
  };

  s.startScene = function(room, actor, objectNr) {
    var t = this, slot;

    log("Start scene "+room+" (old room "+t._currentRoom+")");
    // fadeOut
    slot = t.getScriptSlot(t._currentScript);
    if(t._currentScript != 0xFF) {
      if(slot.where == "room" || slot.where == "flobject" || slot.where == "local") {
        t._currentScript = 0xFF;
      }
    }

    t.runExitScript();
    // killScriptsAndResources
    t.clearDrawQueues();
    // hideActors
    t._fullRedraw = true;
    t._currentRoom = room;
    t._roomResource = room;
    // clearRoomObjects

    if(t._currentRoom == 0)
      return;

    t.setupRoomSubBlocks();
    t.resetRoomSubBlocks();
    // initBGBuffers(t._roomHeight)
    // setCamera
    if(t._roomResource == 0)
      return;

    // showActors
    t.runEntryScript();
  };

  s.setupRoomSubBlocks = function() {
    var t = this, i, roomptr, rmhd, ptr, rmim,
        MKID_BE = _system.MKID_BE;

    t._gfx = {ENCD: 0, EXCD:0, EPAL:0, CLUT:0, PALS:0};

    roomptr = t.getResourceAddress("room", t._roomResource);
    if(!roomptr) error("Room "+t._roomResource_+" data not found");

    rmhd = new t.RoomHeader(t.findResourceData(MKID_BE("RMHD"), roomptr));
    window.console.log(rmhd);
    t._roomWidth = rmhd.width;
    t._roomHeight = rmhd.height;
    t._numObjectsInRoom = rmhd.numObjects;


    rmim = t.findResource(MKID_BE("RMIM"), roomptr);
    log(rmim.offset);
    t._gfx["IM00"] = t.findResource(MKID_BE("IM00"), rmim);

    // exit script
    // entry script
    // local scripts

    ptr = t.findResourceData(MKID_BE("CLUT"), roomptr);
    if(ptr) t._gfx["CLUT"] = ptr;

    ptr = t.findResourceData(MKID_BE("TRNS"), roomptr);
    if(ptr) trans = ptr.readUI8();
    else trans = 255;

    // gdi roomChanged
    t._gdi.transparentColor = trans;

  };

  s.resetRoomSubBlocks = function() {
    var t = this;

    t.setCurrentPalette(0);
  }

}());
