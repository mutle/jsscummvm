(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM;

  s.startScene = function(room, actor, objectNr) {
    var t = this, slot;

    log("Start scene "+room);
    // fadeOut
    slot = t.getScriptSlot(t._currentScript);
    if(t._currentScript != 0xFF) {
      if(slot.where == "room" || slot.where == "flobject" || slot.where == "local") {
        t._currentScript = 0xFF;
      }
    }

    t.runExitScript();
    // killScriptsAndResources
    // clearDrawQueues
    t._fullRedraw = true;
    t._currentRoom = room;
    t._roomResource = room;
    // clearRoomObjects
    if(t._currentRoom == 0)
      return;
    // setupRoomSubBlocks
    // resetRoomSubBlocks
    // initBGBuffers(t._roomHeight)
    // setCamera
    if(t._roomResource == 0)
      return;

    // showActors
    t.runEntryScript();
  }

}());
