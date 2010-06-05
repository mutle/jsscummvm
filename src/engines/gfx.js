(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM;

  var screens = ["main", "text", "verb", "unknown"];
  var MKID_BE = ScummVM.system.MKID_BE;
  var IMxx_tags = [ MKID_BE('IM00'), MKID_BE('IM01'), MKID_BE('IM02'), MKID_BE('IM03'), MKID_BE('IM04'), MKID_BE('IM05'), MKID_BE('IM06'), MKID_BE('IM07'), MKID_BE('IM08'), MKID_BE('IM09'), MKID_BE('IM0A'), MKID_BE('IM0B'), MKID_BE('IM0C'), MKID_BE('IM0D'), MKID_BE('IM0E'), MKID_BE('IM0F'), MKID_BE('IM10') ];
  var zplane_tags = [  MKID_BE('ZP00'), MKID_BE('ZP01'), MKID_BE('ZP02'), MKID_BE('ZP03'), MKID_BE('ZP04') ];

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
    t.numStrips = Math.floor(engine._screenWidth / 8);
    
    t.dbAllowMaskOr = 1 << 0;
    t.dbDrawMaskOnAll = 1 << 1;
    t.dbObjectMode = 2 << 2;

    t.drawBitmap = function(src, vs, x, y, width, height, stripnr, numstrip, flag) {
      var vm = t.engine, dst, limit, numstrip, sx, frontBuf, transpStrip, offset;
      var smap_ptr = vm.findResource(_system.MKID_BE("SMAP"), src), tmsk_ptr = vm.findResource(_system.MKID_BE("TMSK"), src), numzbuf = 0, zplane_list = [];

      log("drawing bitmap "+x+" "+y+" "+width+" "+height);

      zplane_list = t.getZPlanes(src, false);
      window.console.log("zplane_list");
      window.console.log(zplane_list);
      numzbuf = zplane_list.length;

      t.vertStripNextInc = height * vs.pitch - 1;
      t.objectMode = (flag & t.dbObjectMode) == t.dbObjectMode;

      sx = x - Math.floor(vs.xstart / 8);
      if(sx < 0) {
        numstrip -= -sx;
        x += -sx;
        stripnr += -sx;
        sx = 0;
      }

      limit = Math.floor(Math.max(vm._roomWidth, vs.w) / 8) - x;
      if(limit > numstrip)
        limit = numstrip;
      if(limit > t.numStrips - sx)
        limit = t.numstrips - sx;

      for(k = 0; k < limit; ++k, ++stripnr, ++sx, ++x) {
        offset = y * vs.pitch + (x * 8);
        // adjust vs dirty
        if(vs.number == 0) {
          dst = vs.backBuf.newRelativeStream(offset);
        } else {
          dst = vs.pixels.newRelativeStream(offset);
        }
        transpStrip = t.drawStrip(dst, vs, x, y, width, height, stripnr, smap_ptr);

        if(vs.number == 0) {
          dst = vs.backBuf.newRelativeStream(offset);
          frontBuf = vs.pixels.newRelativeStream(offset);
          t.copy8Col(frontBuf, vs.pitch, dst, height, 1);
        }

        t.decodeMask(x, y, width, height, stripnr, numzbuf, zplane_list, transpStrip, flag, tmsk_ptr);

        // Debug mask
        var dst1, dst2, mask_ptr, i, h, j, maskbits;
        for(i = 0; i < numzbuf; i++) {
          dst1 = vs.pixels.newRelativeStream(offset);
          dst2 = null;
          if(vs.number == 0) {
            dst2 = vs.backBuf.newRelativeStream(offset);
          }
          mask_ptr = t.getMaskBuffer(x, y, i);
          for(h = 0; h < height - 1; h++) {
            maskbits = mask_ptr.readUI8();
            // window.console.log("mask x "+x+" y "+h+" "+maskbits.toString(2));
            for(j = 0; j < 8; j++) {
              if(maskbits & 0x80) {
                dst1.writeUI8(12 + i);
                // if(dst2) dst2.writeUI8(12);
              } else {
                dst1.seek(1);
                // if(dst2) dst2.seek(1);
              }
              maskbits <<= 1;
            }
            dst1.seek(vs.pitch - 8);
            mask_ptr.seek(t.numStrips - 1);
            // if(dst2) dst2.seek(vs.pitch - 8);
          }
        }
      }
      // debugBitmap(vs.pixels, 320, 200);
    };

    var curStrip = 0;

    t.drawStrip = function(dst, vs, x, y, width, height, stripnr, smap_ptr) {
      var offset = -1, smapLen, headerOffset = smap_ptr.offset, smap = smap_ptr.newRelativeStream(-headerOffset);

      curStrip = stripnr;
      smap.readUI32(true);
      smapLen = smap.readUI32(true);
      if(stripnr * 4 + 8 < smapLen)
        offset = smap.seek(stripnr * 4 + 8, true).readUI32();
      smap.offset = offset;
      // log("drawing Strip "+stripnr+" "+x+" from offset "+offset+" "+smap.offset);
      return t.decompressBitmap(dst, vs.pitch, smap, height);
    };

    t.getMaskBuffer = function(x, y, z) {
      var buf = t.engine.getResourceAddress("buffer", 9), offset = x + y * t.numStrips + t.imgBufOffs[z];
      buf.seek(0, true);
      return buf.newRelativeStream(offset - 8);
    }

    t.decodeMask = function(x, y, width, height, stripnr, numzbuf, zplane_list, transpStrip, flag, tmsk_ptr) {
      var t = this, i, mask_ptr, z_plane_ptr;

      if(flag & t.dbDrawMaskOnAll) {
        log("draw all");
      } else {
        for(i = 1; i < numzbuf; i++) {
          var offs, zplane;

          if(!zplane_list[i])
            continue;

          zplane = zplane_list[i].newRelativeStream(stripnr * 2 + 8);
          offs = zplane.readUI16();

          mask_ptr = t.getMaskBuffer(x, y, i);

          if(offs) {
            z_plane_ptr = zplane_list[i].newRelativeStream(offs);
            if(tmsk_ptr) {
              var tmsk = tmsk_ptr.seek(8).readUI16();
              t.decompressTMSK(mask_ptr, tmsk, z_plane_ptr, height);
            } else if(transpStrip && (flag & t.dbAllowMaskOr)) {
              t.decompressMaskImgOr(mask_ptr, z_plane_ptr, height);
            } else {
              t.decompressMaskImg(mask_ptr, z_plane_ptr, height);
            }
          } else {
            if(!(transpStrip && (flag & t.dbAllowMaskOr)))
              for(var h = 0; h < height; h++)
                mask_ptr.seek(h * t.numStrips).writeUI8(0);
          }
        }
      }
    };

    t.decompressMaskImg = function(dst, src, height) {
      var b,c;
      while(height) {
        b = src.readUI8();
        if(b & 0x80) {
          b &= 0x7F;
          c = src.readUI8();
          do {
            dst.writeUI8(c);
            dst.seek(t.numStrips - 1);
            --height;
          } while(--b && height);
        } else {
          do {
            dst.writeUI8(src.readUI8());
            dst.seek(t.numStrips - 1);
            --height;
          } while(--b && height);
        }
      }
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
        case 24:
        case 25:
        case 26:
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
          log("unknown decompressBitmap code "+code);
        break;
      }
      return transpStrip;
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
          if(!t.transpCheck || color != t.transparentColor)
            t.writeRoomColor(dst, color);
          dst.seek(dstPitch-1, false, true);
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
        dst.seek(-t.vertStripNextInc, false, true);
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
      var s = "", c;
      do {
        var l = "";
        for(i = 0; i < 8; i++) {
          c = src.readUI8();
          dst.writeUI8(c);
          l += c+" ";
        }
        if(height > 1) {
          dst.seek(dstPitch-8);
          src.seek(dstPitch-8);
        }
        s += l + "\n";
      } while(--height);
      // window.console.log(s);
    };

    t.getZPlanes = function(ptr, bmapImage) {
      var numzbuf, i, vm = t.engine, zplane_list = [];
      if(bmapImage)
        zplane_list[0] = vm.findResource(MKID_BE("BMAP"), ptr);
      else
        zplane_list[0] = vm.findResource(MKID_BE("SMAP"), ptr);

      if(t.zBufferDisabled)
        return [];

      numzbuf = t.numZBuffer;
      for(i = 1; i < numzbuf; i++) {
        zplane_list[i] = vm.findResource(zplane_tags[i], ptr);
      }
      return zplane_list;
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

    t.renderTexts();
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
    src = vs.pixels.newRelativeStream(0);
    // src = (vs.number == 0 ? vs.backBuf : vs.pixels).newRelativeStream(0);
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

  s.renderTexts = function() {
    var t = this, texts = t._string, i, text,
        ctx = ScummVM.context, width = ScummVM.width, height = ScummVM.height;
    for(i = 0; i < texts.length; i++) {
      text = texts[i];
      if(!text || !text.text || text.text == " ") continue;
      ctx.font = "sans-serif 16px";
      ctx.textAlign = "center";
      t._charsetColorMap[1] = text.color;
      ctx.fillStyle = t.paletteColor(t._charsetColorMap[text.color]);
      // log("drawing text "+i+" ("+text.text+") at "+text.x+"/"+text.y+" in color "+text.color+" "+ctx.fillStyle);
      ctx.fillText(text.text, text.x, text.y, width - text.x);
    }
  }

  s.addObjectToDrawQueue = function(obj) {
    var t = this;
    t._drawObjectQue.push(obj);
  };

  s.clearDrawObjectQueue = function() {
    var t = this;
    // log("clearing draw queue");
    t._drawObjectQue = new Array();
  };

  s.clearDrawQueues = function() {
    this.clearDrawObjectQueue();
  };

  s.processDrawQueue = function() {
    var t = this, i, j;
    // log("processing draw queue");
    // window.console.log(t._drawObjectQue);
    for(i = 0; i < t._drawObjectQue.length; i++) {
      log("draw queue "+i);
      j = t._drawObjectQue[i];
      if(j) t.drawObject(j, 0);
    }
    t.clearDrawObjectQueue();
  };

  s.drawObject = function(obj, arg) {
    if(this._skipDrawObject) return;
    var t = this, od = t._objs[obj], height, width, ptr, x, a, numstrip, tmp;

    if(t._bgNeedsRedraw) arg = 0;
    if(od.obj_nr == 0) return;

    var xpos = Math.floor(od.x_pos / 8),
        ypos = od.y_pos;

    width = Math.floor(od.width / 8);
    height = od.height &= 0xFFFFFFF8;

    if(width == 0 || xpos > t._screenEndStrip || xpos + width < s._screenStartStrip)
      return;

    window.console.log(od);
    ptr = t.getObjectImage(t.getOBIMFromObjectData(od), t.getState(od.obj_nr));
    if(!ptr) return;


    x = 0xFFFF;
    for(a = numstrip = 0; a < width; a++) {
      tmp = xpos + a;
      if(tmp < t._screenStartStrip || t._screenEndStrip < tmp)
        continue;
      if(arg > 0 && t._screenStartStrip + arg <= tmp)
        continue;
      if(arg < 0 && tmp <= t._screenEndStrip + arg)
        continue;
      if(tmp < x)
        x = tmp;
      numstrip++;
    }

    if(numstrip != 0) {
      var flags = od.flags | t._gdi.dbObjectMode;
      t._gdi.drawBitmap(ptr, t._virtscreens[0], x, ypos, width * 8, height, x - xpos, numstrip, flags);
    }
  };

  s.getObjectImage = function(ptr, state) {
    var t = this, im_ptr;
    log("image state "+state);
    im_ptr = t.findResource(IMxx_tags[state], ptr);
    return im_ptr;
  }

  s.getOBIMFromObjectData = function(od) {
    var t = this, ptr;
    if(od.fl_object_index) {
      ptr = t.getResourceAddress("fl_object", od.fl_object_index);
      ptr = t.findResource(_system.MKID_BE("OBIM"), ptr);
    } else {
      ptr = t.getResourceAddress("room", t._roomResource);
      ptr.offset = od.OBIMoffset;
      ptr.readUI32(true);
      ptr.offset = od.OBIMoffset;
    }
    return ptr;
  };

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
    var t = this, val = 0;
    log("redrawing bg");
    t.redrawBGStrip(0, t._gdi.numStrips);

    // t.drawRoomObjects(val);
    t._fullRedraw = false;
    t._bgNeedsRedraw = false;
  };

  s.initBGBuffers = function(height) {
    var t = this, room, ptr, i, size, itemsize;
    room = t.getResourceAddress("room", t._roomResource);
    ptr = t.findResource(MKID_BE("RMIH"), t.findResource(MKID_BE("RMIM"), room));
    ptr.seek(8);
    t._gdi.numZBuffer = ptr.readUI16() + 1;

    itemsize = (t._roomHeight + 4) * t._gdi.numStrips;
    size = itemsize * t._gdi.numZBuffer;

    t._res.createResource("buffer", 9, size, -1);
    for(i = 0; i < t._gdi.imgBufOffs.length; i++) {
      if(i < t._gdi.numZBuffer)
        t._gdi.imgBufOffs[i] = i * itemsize;
      else
        t._gdi.imgBufOffs[i] = (t._gdi.numZBuffer - 1) * itemsize;
    }
  };

}());
