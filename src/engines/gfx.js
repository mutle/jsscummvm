(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM;

  var screens = ["main", "text", "verb", "unknown"];

    function debugBitmap(bitmap, w, h) {
      var i = 0, j = 0, out = "", bitmap = bitmap.newRelativeStream(0);
      for(i=0; i < h; i++) {
        var line = i+"  -> ";
        for(j=0; j < w; j++) {
          line += bitmap.readUI8() + " ";
        }
        out += line + "<br />";
      }
      log(out);
    }


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
    t.roomPalette = engine._roomPalette;
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

      // log("drawing bitmap "+x+" "+y+" "+width+" "+height);
      // getZplanes
      // t.prepareDrawBitmap(src, vs, x, y, width, height, stripnr, numstrip);
      t.vertStripNextInc = height * vs.pitch - 1;

      sx = x - vs.xstart / 8;
      if(sx < 0) {
        numstrip -= -sx;
        x += -sx;
        stripnr += -sx;
        sx = 0;
      }

      limit = Math.max(vm._roomWidth, vs.w) / 8 - x;
      if(limit > numstrip)
        limit = numstrip;
      if(limit > t.numStrips - sx)
        limit = t.numstrips - sx;

      for(k = 0; k < limit; ++k, ++stripnr, ++sx, ++x) {
        var offset = y * vs.pitch + (x * 8);
        // adjust vs dirty
        if(vs.number == 0) {
          dst = vs.backBuf.newRelativeStream(offset);
        } else {
          dst = vs.pixels.newRelativeStream(offet)
        }
        transpStrip = t.drawStrip(dst, vs, x, y, width, height, stripnr, smap_ptr);

        // decodeMask(x, y, width, height, stripnr, numzbuf, zplane_list, transpStrip, flag, tmsk_ptr);

        if(vs.number == 0) {
          // render frontBuf
          // dst.seek(offset, true);
          // var frontBuf = vs.pixels.newRelativeStream(offset);
          // t.copy8Col(frontBuf, vs.pitch, dst, height, 1);
        }
      }
      if(t.engine._debug) {
        var stream = vs.backBuf.newRelativeStream(0);
        for(var n = 0; n < 6; n++) {
          var i = 0;
          for(var i = 0; i < 255; i++)
            stream.writeUI8(i % 255);
          stream.seek(320 - i);
        }
        debugBitmap(vs.backBuf, width, height);
      }
    };

    var curStrip = 0;

    t.drawStrip = function(dst, vs, x, y, width, height, stripnr, smap_ptr) {
      var offset = -1, smapLen, headerOffset = smap_ptr.offset, smap = smap_ptr.newRelativeStream(-headerOffset);

      curStrip = stripnr;
      smap.readUI32(true);
      smapLen = smap.readUI32(true);
      if(stripnr * 4 + 8 < smapLen)
        offset = smap.seek(stripnr * 4 + 8, true).readUI32();
      smap.seek(offset, true);
      return t.decompressBitmap(dst, vs.pitch, smap, height);
    };

    t.decompressBitmap = function(dst, dstPitch, src, numLinesToProcess) {
      var code = src.readUI8(), transpStrip = false;
      t.paletteMod = 0;
      t.decomp_shr = code % 10;
      t.decomp_mask = 0xFF >> (8 - t.decomp_shr);

      switch(code) {
        case 1:
          t.drawStripRaw(dst, dstPitch, src, numLinesToProcess, false);
          debug(5, "drawing strip "+curStrip+" (x offset "+(curStrip*8)+") raw");
        break;
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
          t.drawStripBasicV(dst, dstPitch, src, numLinesToProcess, false);
          debug(5, "drawing strip "+curStrip+" (x offset "+(curStrip*8)+") basic V");
        break;
        case 27:
        case 28:
          t.drawStripBasicH(dst, dstPitch, src, numLinesToProcess, false);
          debug(5, "drawing strip "+curStrip+" (x offset "+(curStrip*8)+") basic H");
        break;
        case 64:
        case 65:
        case 66:
        case 67:
        case 68:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
          t.drawStripComplex(dst, dstPitch, src, numLinesToProcess, false);
          debug(5, "drawing strip "+curStrip+" (x offset "+(curStrip*8)+") complex");
        break;
        default:
          debug(5, "unknown decompressBitmap code "+code);
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
          else
            dst.seek(1);
        }
        dst.seek(dstPitch);
      } while(--height);
    };

    t.writeRoomColor = function(dst, color) {
      c = this.roomPalette[(color + this.paletteMod) & 0xFF];
      dst.writeUI8(c);
    };


    t.drawStripComplex = function(dst, dstPitch, src, height, transpCheck) {
      var t = this, color = src.readUI8(), bits = src.readUI8(), cl = 8, bit, incm, reps;
      var x = 8;
      // return;

      var READ_BIT = function() {
        cl--; bit = bits & 1; bits >>= 1; return bit;
      }, FILL_BITS = function(n) {
        if(cl <= 8) {
          bits |= (src.readUI8() << cl);
          cl += 8;
        }
      };

      var againPos = function() {
        if(!READ_BIT()) {
        } else if(!READ_BIT()) {
          FILL_BITS();
          color = bits & t.decomp_mask;
          bits >>= t.decomp_shr;
          cl -= t.decomp_shr;
        } else {
          incm = (bits & 7) - 4;
          cl -= 3;
          bits >>= 3;
          if(incm) {
            color += incm;
          } else {
            FILL_BITS();
            reps = bits & 0xFF;
            do {
              if(!--x) {
                x = 8;
                height--;
                if(height <= 1)
                  return;
                dst.seek(dstPitch - 8);
              }
              if(!t.transpCheck || color != t.transparentColor)
                t.writeRoomColor(dst, color);
              else
                dst.seek(1);
            } while(--reps);
            bits >>= 8;
            bits |= src.readUI8() << (cl - 8);
            againPos();
          }
        }
      };
      do {
        x = 8;
        do {
          FILL_BITS();
          if(!t.transpCheck || color != t.transparentColor)
            t.writeRoomColor(dst, color);
          else
            dst.seek(1);
          againPos();
        } while(--x);
        if(height > 1)
          dst.seek(dstPitch - 8);
        if(height <= 1) return;
      } while(--height);

    };

    t.drawStripBasicH = function(dst, dstPitch, src, height, transpCheck) {
      var t = this, color = src.readUI8(), bits = src.readUI8(), cl = 8, bit, inc = -1;

      var READ_BIT = function() {
        cl--; bit = bits & 1; bits >>= 1; return bit;
      }, FILL_BITS = function(n) {
        if(cl <= 8) {
          bits |= (src.readUI8() << cl);
          cl += 8;
        }
      };

      do {
        var x = 8;
        do {
          FILL_BITS();
          if(!t.transpCheck || color != t.transparentColor)
            t.writeRoomColor(dst, color);
          else
            dst.seek(1);
          if(!READ_BIT()) {
          } else if(!READ_BIT()) {
            FILL_BITS();
            color = bits & t.decomp_mask;
            bits >>= t.decomp_shr;
            cl -= t.decomp_shr;
            inc = -1;
          } else if(!READ_BIT()) {
            color += inc;
          } else {
            inc = -inc;
            color += inc;
          }
        } while(--x);
        if(height > 1)
          dst.seek(dstPitch - 8);
      } while(--height);
    };

    t.drawStripBasicV = function(dst, dstPitch, src, height, transpCheck) {
      var t = this, color = src.readUI8(), bits = src.readUI8(), cl = 8, bit, inc = -1;

      var READ_BIT = function() {
        cl--; bit = bits & 1; bits >>= 1; return bit;
      }, FILL_BITS = function(n) {
        if(cl <= 8) {
          bits |= (src.readUI8() << cl);
          cl += 8;
        }
      };

      var x = 8;
      do {
        var h = height;
        do {
          FILL_BITS();
          if(h == 1) continue;
          if(!t.transpCheck || color != t.transparentColor)
            t.writeRoomColor(dst, color);
          else
            dst.seek(1);
          dst.seek(dstPitch-1);
          if(!READ_BIT()) {
          } else if(!READ_BIT()) {
            FILL_BITS();
            color = bits & t.decomp_mask;
            bits >>= t.decomp_shr;
            cl -= t.decomp_shr;
            inc = -1;
          } else if(!READ_BIT()) {
            color += inc;
          } else {
            inc = -inc;
            color += inc;
          }
        } while(--h);
        dst.seek(-t.vertStripNextInc);
      } while(--x);
    };
    t.drawStripBasicH = function(dst, dstPitch, src, height, transpCheck) {
      var t = this, color = src.readUI8(), bits = src.readUI8(), cl = 8, bit, inc = -1;

      var READ_BIT = function() {
        cl--; bit = bits & 1; bits >>= 1; return bit;
      }, FILL_BITS = function(n) {
        if(cl <= 8) {
          bits |= (src.readUI8() << cl);
          cl += 8;
        }
      };

      do {
        var x = 8;
        do {
          FILL_BITS();
          if(!t.transpCheck || color != t.transparentColor)
            t.writeRoomColor(dst, color);
          if(!READ_BIT()) {
          } else if(!READ_BIT()) {
            FILL_BITS();
            color = bits & t.decomp_mask;
            bits >>= t.decomp_shr;
            cl -= t.decomp_shr;
            inc = -1;
          } else if(!READ_BIT()) {
            color += inc;
          } else {
            inc = -inc;
            color += inc;
          }
        } while(--x);
        if(height > 1)
          dst.seek(dstPitch - 8);
      } while(--height);
    };

    t.copy8Col = function(dst, dstPitch, src, height, bitDepth) {
      var i = 0;
      do {
        for(i = 0; i < 8; i++) {
          dst.writeUI8(src.readUI8());
        }
        if(height > 1) {
          dst.seek(dstPitch);
          src.seek(dstPitch);
        }
      } while(--height);
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
      size += vs.pitch * 4;
    }

    res.createResource("buffer", slot+1, size, -1);
    vs.pixels = t.getResourceAddress("buffer", slot+1);
    // reset pixels to 0
    if(slot == 0) {
      vs.backBuf = res.createResource("buffer", slot + 5, size, -1);
    }
  };

  s.drawDirtyScreenParts = function() {
    var t = this,
        ctx = ScummVM.context, width = ScummVM.width, height = ScummVM.height;

    ctx.fillStyle = "black";
    ctx.fillRect(0,0,width,height);

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
    if(top < 0) top = 0;
    if(bottom > t._screenHeight) bottom = t._screenHeight;

    y = vs.topline + top;
    height = bottom - top;

    if(width <= 0 || height <= 0) return;

    // log("drawing strip to screen ("+x+"/"+y+") ("+(x+width)+"/"+(y+height)+")");
    src = (vs.number == 0 ? vs.backBuf : vs.pixels).newRelativeStream(0);
    dst = ctx.getImageData(x, y, width, height);
    var vsPitch = vs.pitch - width, pitch = vs.pitch, h, w;

    i = 0;
    for(h = 0; h < height; h++) {
      for(w = 0; w < width; w++) {
        palcolor = src.readUI8();
        color = pal[palcolor];
        if(color) {
          dst.data[i * 4] = color[0];
          dst.data[i * 4 + 1] = color[1];
          dst.data[i * 4 + 2] = color[2];
        }
        i++;
      }
    }
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
    t._bgNeedsRedraw = false;
    t.redrawBGStrip(0, t._gdi.numStrips);
  };

  s.initBGBuffers = function() {
    var t = this, room, ptr;
    room = t.getResourceAddress("room", t._roomResource);
  }

}());
