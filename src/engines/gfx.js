(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM;

  var screens = ["main", "text", "verb", "unknown"];

  s.VirtScreen = function(n) {
    this.number = n;
    this.name = screens[n];
    this.topline = 0;
    this.xstart = 0;
    this.backBuf = null;
    this.pixels = null;
    this.pitch = 0;
  };

  s.initGraphics = function() {
    var t = this,
        ctx = ScummVM.context, width = ScummVM.width, height = ScummVM.height;

    this.imageData = ctx.getImageData(0, 0, width, height);
    ctx.fillStyle = "black";
    ctx.fillRect(0,0,width,height);
  };

  s.initScreens = function(b, h) {
    var t = this, i, adj = 0,
        width = ScummVM.width, height = ScummVM.height;
    if(!t.getResourceAddress("buffer", 4)) {
      log("unknown screen");
      t.initVirtScreen(3, 80, width, 13, false);
    }

    t.initVirtScreen(0, b + adj, width, h, -b, true);
    // t.initVirtScreen("text")
    t.initVirtScreen(2, h + adj, width, height - h - adj, false);
    t._screenB = b;
    t._screenH = h;
  };

  s.initVirtScreen = function(slot, top, width, height, scrollable) {
    var t = this, vs, size,
            res = t._res;

    vs = t._virtscreens[slot];
    if(!vs) {
      vs = new t.VirtScreen(slot);
      t._virtscreens[slot] = vs;
    }
    vs.number = slot;
    vs.w = width;
    vs.topline = top;
    vs.h = height;
    vs.xstart = 0;
    vs.pitch = width;

    size = vs.pitch;
    if(scrollable) {
      size += vs.putch * 4;
    }

    res.createResource("buffer", slot+1, size);
    vs.pixels = t.getResourceAddress("buffer", slot+1);
    // reset pixels to 0
    if(slot == 0) {
      vs.backBuf = res.createResource("buffer", slot + 5, size);
    }
  };

  s.drawDirtyScreenParts = function() {
    var t = this,
        ctx = ScummVM.context, width = ScummVM.width, height = ScummVM.height;

    this.imageData = ctx.getImageData(0, 0, width, height);

    t.updateDirtyScreen(2); // Verb

    t.updateDirtyScreen(0); // Main

    // Draw
    // ctx.putImageData(this.imageData, 0, 0);
  };

  s.updateDirtyScreen = function(n) {
    var t = this, vs = t._virtscreens[n];

    t.drawVirtualScreenToScreen(vs);
  };

  s.drawVirtualScreenToScreen = function(vs) {
    var t= this, ctx = ScummVM.context;

    // src = vs.pixels;
    ctx.fillStyle = vs.number ==  0 ? "red" : "blue";
    ctx.fillRect(0, vs.topline, vs.w, vs.h);
  };

}());
