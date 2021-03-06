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

    dest = t._currentPalette;
    for(i = firstIndex; i < numcolor; i++) {
      r = ptr.readUI8(); g = ptr.readUI8(); b = ptr.readUI8();
      t._currentPalette[i] = [r,g,b];
    }
  };

  s.paletteColor = function(idx, palette) {
    var t = this, color = "#", i, c, pal_color = (palette ? palette[idx] : t._currentPalette[idx]);

    for(i = 0; i < 3; i++) {
      c = pal_color[0].toString(16)
      color += (c.length == 1 ? "0" + c : c)
    }
    return color;
  }

  s.updatePalette = function() {
  };
}());
