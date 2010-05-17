(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM;

  s.startScene = function(room, actor, objectNr) {
    var t = this;

    log("Start scene "+room);
    // runExitScript
    // killScriptsAndResources
    // clearDrawQueue
    t._fullRedraw = true;
    t._currentRoom = room;
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
    // runEntryScript
  }

}());
