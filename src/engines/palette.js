(function(){
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM;

  s.resetPalette = function() {
    s.setDirtyColors(0, 255);
  };

  s.setDirtyColors = function(min, max) {
    var t = this;
    if(t._palDirtyMin > min)
      t._palDirtyMin = min
    if(t._palDirtyMax > max)
      t._palDirtyMax = max
  };

  s.setCurrentPalette = function(palindex) {
    var t = this;
    t._curPalIndex = palindex;
    log("setCurrentPalette");
    pals = t.getPalettePtr(t._curPalIndex, t._roomResource);
    t.setPaletteFromPtr(pals);
  };

  s.getPalettePtr = function(palindex, room) {
    var t = this;
    if(t._gfx["CLUT"]) return t._gfx["CLUT"];
    else error("no clut");
    return null;
  };

  s.setPaletteFromPtr = function(ptr, numcolor) {
    var t = this, firstIndex = 0, i, dest, r, g, b;

    if(!numcolor || numcolor < 0) {
      numcolor = t.getResourceDataSize(ptr) / 3;
    }
    log(numcolor+" colors in palette");

    dest = t._currentPalette;
    for(i = firstIndex; i < numcolor; i++) {
      r = ptr.readUI8(); g = ptr.readUI8(); b = ptr.readUI8();
      t._currentPalette[i] = [r,g,b];
      log(i+" #"+r.toString(16)+g.toString(16)+b.toString(16));
    }
  };

  s.updatePalette = function() {
  };
}());
