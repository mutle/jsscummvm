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

  s.Gdi = function(engine) {
    var t = this;
    t.engine = engine;
    t.paletteMod = 0;
    t.roomPalette = [];
    t.numStrips = 0;
    t.transparentColor = 255;
    t.decomp_shr = 0;
    t.decomp_mask = 0;
    t.vertStripNextInc = 0;
    t.zBufferDisabled = false;
    t.objectMode = false;
    t.numZBuffer = 0;
    t.imgBufOffs = [0, 0, 0, 0, 0, 0, 0, 0];
    t.numStrips = engine._screenWidth / 8;

    t.drawBitmap = function(src, vs, x, y, width, height, stripnr, numstrip, flag) {
      var vm = t.engine, dst, limit, numstrip, sx;
      var smap_ptr = vm.findResource(_system.MKID_BE("SMAP"), src);

      log("drawing bitmap "+x+" "+y+" "+width+" "+height);
      // getZplanes
      // t.prepareDrawBitmap(src, vs, x, y, width, height, stripnr, numstrip);

      sx = x - vs.xstart / 8;
      if(sx < 0) {
        numstrip -= -sx;
        x += -sx;
        stripnr += -sx;
        sx = 0;
      }
      log(numstrip);

      limit = Math.max(vm._roomWidth, vs.w) / 8 - x;
      if(limit > numstrip)
        limit = numstrip;
      if(limit > t.numStrips - sx)
        limit = t.numstrips - sx;
      log(limit);
      for(k = 0; k < limit; ++k, ++stripnr, ++sx, ++x) {
        log("k "+k+" stripnr "+stripnr);
        // adjust vs dirty
        if(vs.number == 0) {
          dst = vs.backBuf.newRelativeStream(y * vs.pitch + (x * 8));
        } else {
          dst = vs.pixels.newRelativeStream(y * vs.pitch + (x * 8))
        }
        transpStrip = t.drawStrip(dst, vs, x, y, width, height, stripnr, smap_ptr);

        // decodeMask(x, y, width, height, stripnr, numzbuf, zplane_list, transpStrip, flag, tmsk_ptr);

        if(vs.number == 0) {
          // frontBuf
        }
      }
    };

    t.drawStrip = function(dst, vs, x, y, width, height, stripnr, smap_ptr) {
      var offset = -1, smapLen, headerOffset = smap_ptr.offset;

      log("drawStrip "+stripnr);

      smapLen = smap_ptr.readUI32(true);
      if(stripnr * 4 + 8 < smapLen)
        offset = smap_ptr.seek(stripnr * 4 + 8, true);
      smap_ptr.seek(headerOffset + offset, true);
      return t.decompressBitmap(dst, vs.pitch, smap_ptr, height);
    };

    t.decompressBitmap = function(dst, dstPitch, src, numLinesToProcess) {
      var code = src.readUI8(), transpStrip = false;
      t.paletteMod = 0;
      t.decomp_shr = code % 10;
      t.decomp_mask = 0xFF >> (8 - t.decomp_shr);

      switch(code) {
        case 1:
          t.drawStripRaw(dst, dstPitch, src, numLinesToProcess, false);
        break;
        default:
          log("unknown decompressBitmap code "+code);
        break;
      }

    };

    t.drawStripRaw = function(dst, dstPitch, src, height, transpCheck) {
      do {
        for(x = 0; x < 8; x++) {
          color = src.readUI8();
          dst.seek(x);
          if(!transpCheck || color != t.transparentColor)
            t.writeRoomColor(dst, color);
        }
        dst.seek(dstPitch);
      } while(--height);
    };

    t.writeRoomColor = function(dst, color) {
      dst.writeUI8(color);
    };
  };


  s.initGraphics = function() {
    var t = this,
        ctx = ScummVM.context, width = ScummVM.width, height = ScummVM.height;

    ctx.fillStyle = "black";
    ctx.fillRect(0,0,width,height);

    t._gdi = new t.Gdi(t);
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

    size = vs.pitch * vs.h;
    if(scrollable) {
      size += vs.puich * 4;
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

    t.updateDirtyScreen(2); // Verb

    if(true) {
      vs = t._virtscreens[0];
      t.drawStripToScreen(vs, 0, vs.w, 0, vs.h);
    } else {
      t.updateDirtyScreen(0); // Main
    }
  };

  s.updateDirtyScreen = function(n) {
    var t = this, vs = t._virtscreens[n];

  };

  s.drawStripToScreen = function(vs, x, width, top, bottom) {
    var t = this, y, height
        ctx = ScummVM.context,
        pal = t._currentPalette, i;

    if(bottom <= top || top >= vs.h) return;
    if(width > vs.w - x) width = vs.w - x;

    y = vs.topline + top;
    height = bottom - top;

    if(width <= 0 || height <= 0) return;

    log("drawing strip ("+x+"/"+y+") ("+(x+width)+"/"+(y+height)+")");
    src = vs.pixels;
    dst = ctx.getImageData(x, y, width, height);
    var vsPitch = vs.pitch - width, pitch = vs.pitch, h, w;

    i = 0;
    for(h = height; h > 0; --h) {
      for(w = width; w > 0; w--) {
        palcolor = src.readUI8();
        color = pal[palcolor];
        if(color) {
          i++;
          dst.data[i * 4] = color[0];
          dst.data[i * 4 + 1] = color[1];
          dst.data[i * 4 + 2] = color[2];
        }
      }
    }
    log("found "+i+" pixels");
    ctx.putImageData(dst, x, top);
  };

  s.clearDrawObjectQueue = function() {
    var t = this;
    t._drawObjectQue = new Array();
  };

  s.clearDrawQueues = function() {
    this.clearDrawObjectQueue();
  }

  s.markObjectRectAsDirty = function(obj) {
    var t = this;

    t._bgNeedsRedraw = true;
  };

  s.redrawBGStrip = function(start, num) {
    var t = this, strip = t._screenStartStrip + start, room, i;

    //for(i = 0; i < num; i++)
      // setGfxUsageBits DIRTY

    room = t.getResourceAddress("room", t._roomResource);

    t._gdi.drawBitmap(t._gfx["IM00"], t._virtscreens[0], strip, 0, t._roomWidth, t._virtscreens[0].h, strip, num, 0);

  };

  s.redrawBGAreas = function() {
    var t = this;
    log("redrawing BG Areas");
    t._bgNeedsRedraw = false;
    log("strips "+t._gdi.numStrips);
    t.redrawBGStrip(0, t._gdi.numStrips);
  };

}());
