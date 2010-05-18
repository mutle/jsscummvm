(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM,
      NUM_SCRIPT_SLOT = 80;

  s.ScriptSlot = function(slot) {
    var t = this;
    t.number = 0;
    t.offs = 0;
    t.status = "dead";
    t.where = "";
    t.freezeResistant = false;
    t.recursive = false;
    t.freezeCount = 0;
    t.delayFrameCount = 0;
    t.didexec = false;
    t.args = [];
    t.slot = slot;
    t.cycle = 0;
  };

  s.NestedScript = function() {
    var t = this;
    t.number = 0;
    t.where = "";
    t.slot = 0;
  };

  s.VirtualMachineState = function() {
    var t = this;
    t.slot = [];
    t.nest = [];
    t.numNestedScripts = 0;
    t.localvar = []

    for(var i = 0; i < 80; i++) {
      if(i < 15)
        t.nest[i] = new s.NestedScript();
      t.slot[i] = new s.ScriptSlot(i);
      t.localvar[i] = [];
    }
  }

  s.scummVar = function(name) {
    var t = this;
    return t._scummVars[t._vars[name]];
  }

  s.runBootscript = function() {
     var t = this, i;
     args = [];
     for(i = 0; i < 16; i++) {
       args[i] = 0;
     }
     args[0] = t._bootParam;
     t.runScript(1, 0, 0, args);
  };

  s.runAllScripts = function() {
    var t = this, i, vm = t._vm, numCycles = 1, cycle, slot;

    for(i = 0; i < vm.slot.length; i++) {
      slot = vm.slot[i];
      slot.didexec = false;
    }
    t._currentScript = 0xFF;
    for(cycle = 1; cycle <= numCycles; cycle++) {
      for(i = 0; i < vm.slot.length; i++) {
        slot = vm.slot[i];
        if(slot.cycle == cycle && slot.status == "running" && !slot.didexec) {
          t._currentScript = i;
          t.getScriptBaseAddress();
          t.getScriptEntryPoint();
          t.executeScript();
        }
      }
    }
  }

  s.runScript = function(script, freezeResistant, recursive, args, cycle) {
    var t = this, slot, scriptPtr, scriptOffs, scriptType;
    if(!script) return;
    if(!recursive) t.stopScript(script);


    if(script < t._nums['global_scripts']) {
      scriptPtr = t.getResourceAddress("script", script);
      scriptOffs = 8;
      scriptType = "global";
      log("runScript(Global-"+script+")");
    } else {
      scriptType = "local";
      log("runScript("+script+")");
    }

    if(!cycle) cycle = 1;

    slot = t.getScriptSlot();
    slot.number = script;
    slot.offs = scriptOffs;
    slot.status = "running";
    slot.where = scriptType;
    slot.freezeResistant = freezeResistant;
    slot.recursive = recursive;
    slot.freezeCount = 0;
    slot.delayFrameCount = 0;
    slot.cycle = cycle;

    t.initializeLocals(slot.slot, args);

    t.runScriptNested(slot);
  };

  s.runScriptNested = function(slot) {
    var t = this, nest;

    t.updateScriptPtr();

    nest = t._vm.nest[t._vm.numNestedScripts];

    if(t._currentScript == 0xFF) {
      nest.number = 0xFF;
      nest.where = "";
    } else {
      nest.number = slot.number;
      nest.where = slot.where;
      nest.slot = t._currentScript;
    }

    t._vm.numNestedScripts++;
    t._currentScript = slot.slot;

    t.getScriptBaseAddress();
    t.getScriptEntryPoint();
    t.executeScript();


    if(t._vm.numNestedScripts > 0)
      t._vm.numNestedScripts--;

    if(nest.number != 0xFF) {
      t._currentScript = nest.slot;
      t.getScriptBaseAddress();
      t.getScriptEntryPoint();
      return;
    }

    t._currentScript = 0xFF;
  };

  s.runExitScript = function() {
    var t = this, s = 0;
    if(s = t.scummVar("exit_script")) {
      t.runScript(s, 0, 0, 0);
    }

    if(s = t.scummVar("exit_script2")) {
      t.runScript(s, 0, 0, 0);
    }
  };

  s.runEntryScript = function() {
    var t = this;
    log("Entry script");
    if(s = t.scummVar("entry_script")) {
      log("Entry script");
      t.runScript(s, 0, 0, 0);
    }
    if(s = t.scummVar("entry_script2")) {
      t.runScript(s, 0, 0, 0);
    }
  };

  s.updateScriptPtr = function() {
    var t = this;
    if(t._currentScript == 0xFF) {
      return;
    }
    t._vm.slot[t._currentScript].offs = t._scriptPointer.offset;
  }

  s.stopScript = function(script) {
    var t = this, i, slot, nest,
        slots = t._vm.slot;
    if(script == 0)
      return;
    for(i = 0; i < slots.length; i++) {
      slot = slots[i];
      if(script == slot.number && slot.status != "dead" && (slot.where == "global" || slot.where == "local")) {
        slot.number = 0;
        slot.status = "dead";
        // nukeArrays(i);
        if(t._currentScript == i)
          t._currentScript = 0xFF;
      }
    }
    for(i = 0; i < t._vm.numNestedScripts; i++) {
      nest = t._vm.nest[i];
      if(script == nest.number && (nest.where == "global" || nest.where == "local")) {
        // nukeArrays(nest.slot);
        nest.number = 0xFF;
        nest.slot = 0xFF;
        nest.where = "";
      }

    }
  };

  s.initializeLocals = function(slot, args) {
    var t = this, localvar = t._vm.localvar[slot], i;
    for(i = 0; i < 25; i++) {
      localvar[i] = args && args[i] ? args[i] : 0;
    }
  }

  s.getScriptSlot = function(n) {
    var t = this, i, slot = null;
    if(n && n > 0) {
      return t._vm.slot[n];
    } else {
      for(i = 1; i < t._vm.slot.length; i++) {
        slot = t._vm.slot[i];
        if(slot && slot.status == "dead")
          return slot;
      }
    }
    return null;
  };

  s.getScriptBaseAddress = function() {
    var t = this, slot;

    if(t._currentScript == 0xFF)
      return;

    // slot = t._vm.slot[t._currentScript]
    slot = t.getScriptSlot(t._currentScript);
    switch(slot.where) {
      case "global":
        t._scriptOrgPointer = t.getResourceAddress("script", slot.number);
        t._lastCodePointer = t._scriptOrgPointer;
      break;
      default:
        log("Unknown script location "+slot.where);
      break;
    }
  };

  s.getScriptEntryPoint = function() {
    var t = this, offset;
    if(t._currentScript == 0xFF)
      return;
    t._scriptPointer = t._scriptOrgPointer.newRelativeStream(t._vm.slot[t._currentScript].offs);
  };

  s.executeScript = function() {
    var t = this;
    var slot = t._vm.slot[t._currentScript];
    while(t._currentScript != 0xFF) {
      if(t._scriptPointer.offset >= t._scriptPointer.length) {
        error("Script out of bounds");
        log(t._scriptPointer.offset);
        slot.number = 0;
        slot.status = "dead";
        t._currentScript = 0xFF;
        return;
      }
      slot = t._vm.slot[t._currentScript];
      // log("executing "+t._currentScript);
      t._opcode = t.fetchScriptByte();
      slot.didexec = true;

      debug(5, "executing opcode 0x"+t._opcode.toString(16));
      t.executeOpcode(t._opcode);
    }
  };

  s.executeOpcode = function(i) {
    var t = this,
        opcodes = t._opcodes;
    if(opcodes[i]) {
      t._opcode = i;
      opcodes[i]();
    } else {
      log("Invalid opcode 0x"+i.toString(16)+" at "+t._scriptPointer.offset+" stopping script execution");
      t._vm.slot[t._currentScript].status = "dead";
      t._currentScript = 0xFF;
    }
  };

  s.setupScummVars = function() {
    var t = this;
    t._vars = {
      keypress: 0,
      room: 4,
      override: 5,
      num_actor: 8,
      entry_script: 28,
      entry_script2: 29,
      exit_script: 30,
      exit_script2: 31,
      timer: 46,
      timer_total: 47,
      room_flag: 70,
      game_loaded: 71,
      new_room: 72
    };
  };

  s.resetScummVars = function() {
    var t = this,
        vm = t._vm;

    vm.numNestedScripts = 0;
    t._currentScript = 0xFF;
    t._currentRoom = 0;
  };

  s.jumpRelative = function(cond) {
    var t = this, offset = t.fetchScriptWordSigned();
    if(!cond) {
      t._scriptPointer.seek(offset);
    }
  }

  s.push = function(a) {
    var t = this;
    t._vmstack[t._scummStackPos++] = a;
  }

  s.pop = function() {
    var t = this;
    return t._vmstack[--t._scummStackPos];
  }

  s.stopObjectCode = function() {
    var t = this, slot = t._vm.slot[t._currentScript];

    if(slot.where != "global" && slot.where != "local") {
      t.stopObjectScript(slot.number);
    } else {
      slot.number = 0;
      // slot.slot = 0;
       slot.status = "dead";
    }
    t._currentScript = 0xFF;
  }

  s.resStrLen = function(stream) {
    var t = this, chr, num = 0;
    if(!stream)
      stream = t._scriptPointer;
    seekStream = stream.newRelativeStream(0);
    while((chr = seekStream.readUI8()) != 0) {
      num++;
    }
    return num;
  }

  s.getResultPos = function() {
    var t = this, a;
    t._resultVarNumber = t.fetchScriptWord();
    if(t._resultVarNumber & 0x2000) {
      a = t.fetchScriptWord();
      if(a & 0x2000) {
        t._resultVarNumber += t.readVar(a & ~0x2000);
      } else {
        t._resultVarNumber &= ~0x2000;
      }
    }
  };

  s.readVar = function(varId) {
    var t = this, a;
    if(varId & 0x2000) {
      a = t.fetchScriptWord();
      if(a & 0x2000)
        varId += t.readVar(a & ~0x2000);
      else
        varId += a & 0xFFF;
      varId &= ~0x2000;
    }
    if(!(varId & 0xF000)) {
      return t._scummVars[varId];
    }
    if(varId & 0x8000) {
      varId &= 0x7FFF;
      return (t._bitVars[varId >> 3] & (1 << (varId & 7))) ? 1 : 0;
    }
    if(varId & 0x4000) {
      varId &= 0xFFF;
      return t._vm.localvar[t._currentScript][varId];
    }
    return -1
  };

  s.writeVar = function(varId, value) {
    var t = this;
    if(!(varId & 0xF000)) {
      t._scummVars[varId] = value;
    }
    if(varId & 0x8000) {
      varId &= 0x7FFF;
      if(value)
        t._bitVars[varId >> 3] |= (1 << (varId & 7));
      else
        t._bitVars[varId >> 3] &= ~(1 << (varId & 7));
    }
    if(varId & 0x4000) {
      varId &= 0xFFF;
      t._vm.localvar[t._currentScript][varId] = value;
    }
  };

  s.getVar = function() {
    var t = this;
    return t.readVar(t.fetchScriptWord());
  }

  s.getVarOrDirectByte = function(mask) {
    var t = this;
    if(t._opcode & mask)
      return t.getVar();
    return t.fetchScriptByte();
  };

  s.getVarOrDirectWord = function(mask) {
    var t = this;
    if(t._opcode & mask)
      return t.getVar();
    return t.fetchScriptWordSigned();
  };

  s.getWordVararg = function() {
    var t = this, data, i;

    for(i = 0; i < 16; i++) {
      data += String.fromCharCode(0);
    }

    i = 0;
    while((t._opcode = t.fetchScriptByte()) != 0xFF) {
      data[i++] = t.getVarOrDirectWord(PARAM_1);
    }
    return data;
  }

  s.setResult = function(value) {
    var t = this;
    t.writeVar(t._resultVarNumber, value);
  };

  s.updateCodePointer = function() {
    var t = this;

    return;
    // log("checking if update is needed "+t._lastCodePointer.offset+" != "+ t._scriptOrgPointer.offset);
    //if(t._lastCodePointer != t._scriptOrgPointer) {
      log("pointer reset");
      oldoffs = t._scriptPointer.offset;
      t.getScriptBaseAddress();
      t._scriptPointer.seek(oldoffs);
    //}
  }

  s.fetchScriptByte = function() {
    this.updateCodePointer();
    var t = this, b = t._scriptPointer;
    return b.readUI8();
  };

  s.fetchScriptWord = function() {
    this.updateCodePointer();
    var t = this, b = t._scriptPointer;
    return b.readUI16();
  };

  s.fetchScriptWordSigned = function() {
    this.updateCodePointer();
    var t = this, b = t._scriptPointer;
    return b.readSI16();
  };

  s.fetchScriptDWord = function() {
    this.updateCodePointer();
    var t = this, b = t._scriptPointer;
    return b.readUI32();
  };

  s.fetchScriptDWordSigned = function() {
    this.updateCodePointer();
    var t = this, b = t._scriptPointer;
    return b.readSI32();
  };

  s.printString = function(slot, source, len) {
    var t = this, msg = source.readString(len);
    log("PRINT "+slot+": "+msg);
  };

  s.decodeParseString = function() {
    var t = this, textSlot, len;

    switch(t._actorToPrintStrFor) {
    case 252:
      textSlot = 3;
    break;
    case 253:
      textSlot = 2;
    break;
    case 254:
      textSlot = 1;
    break;
    default:
      textSlot = 0;
    break;
    }
    t._string[textSlot] = "";
    while((t._opcode = t.fetchScriptByte()) != 0xFF) {
      switch(t._opcode & 0x0F) {
        case 0: // at
          x = t.getVarOrDirectWord(PARAM_1);
          y = t.getVarOrDirectWord(PARAM_2);
        break;
        case 1: // color
        case 2: // clipped
          t.getVarOrDirectByte(PARAM_1);
        break;
        case 4: // center
        case 7: // overhead
        break;
        case 15: // textstring
          len = t.resStrLen(t._scriptPointer);
          t.printString(textSlot, t._scriptPointer, len);
        break;
        default:
          log("unimplemented decodeParseString opcode " + (s._opcode & 0x0F));
        break;
      }
    }
  };

  var unimplementedOpcode = function() {
    log("opcode 0x"+t._opcode.toString(16)+" unimplemented");
  };

  s._opcodeCommands = {
    startScript: function() {
      var op, script, data;

      op = s._opcode;
      script = s.getVarOrDirectByte(PARAM_1);
      data = s.getWordVararg();

      s.runScript(script, (op & 0x20) != 0, (op & 0x40) != 0, data);
    },
    resourceRoutines: function() {
     var resType = ["script", "sound", "costume", "room"], resid = 0;
     s._opcode = s.fetchScriptByte();
     if(s._opcode != 17)
       resid = s.getVarOrDirectByte(PARAM_1);

     var op = s._opcode & 0x3F;
     switch(op) {
       case 1: // load script
       case 2: // load sound
       case 3: // load costume
         s.ensureResourceLoaded(resType[op - 1], resid);
       break;
       case 4: // room
         s.ensureResourceLoaded("room", resid);
         break;
       case 9: // lock script
       break;
       case 10: // lock sound
       break;
       case 11: // lock costume
       break;
       case 17:
       break;
       case 18: // charset
         s.loadCharset(resid);
       break;
       default:
         log("unimplemented resourceRoutines opcode "+op);
       break;
     }
    },
    move: function() {
      s.getResultPos();
      s.setResult(s.getVarOrDirectWord(PARAM_1));
    },
    cursorCommand: function() {
      s._opcode = s.fetchScriptByte();
      switch(s._opcode & 0x1F) {
        case 1: // on
        break;
        case 2: // off
        break;
        case 4: // userput off
        break;
        case 13: // charset set
          no = s.getVarOrDirectByte(PARAM_1);
          // s.initCharset();
        break;
        default:
          log("unimplemented cursorCommand opcode " + (s._opcode & 0x1F));
        break;
      }
    },
    setVarRange : function() {
      var a, b;
      s.getResultPos();
      a = s.fetchScriptByte();
      do {
        if(s._opcode & 0x80)
          b = s.fetchScriptWordSigned();
        else
          b = s.fetchScriptByte();
        s.setResult(b);
        s._resultVarNumber++;
      } while(--a);
    },
    stringOps: function() {
      var a, b, c, i;
      s._opcode = s.fetchScriptByte();
      switch(s._opcode & 0x1F) {
        case 1: // loadstring
          a = s.getVarOrDirectByte(PARAM_1);
          s.loadPtrToResource("string", a, null);
        break;
        case 3: // setStringChar
          a = s.getVarOrDirectByte(PARAM_1);
          b = s.getVarOrDirectByte(PARAM_2);
          c = s.getVarOrDirectByte(PARAM_3);
          ptr = s.getResourceAddress("string", a);
          if(!ptr) {
            error("String "+a+" does not exist");
          }
          ptr.buffer[b] = c;
        break;
        case 5: // createString
          a = s.getVarOrDirectByte(PARAM_1);
          b = s.getVarOrDirectByte(PARAM_2);
          if(b) {
            ptr = s._res.createResource("string", a, b, -1);
          }
          ptr = s.getResourceAddress("string", a);
        break;
        default:
          log("unimplemented stringOps opcode " + (s._opcode & 0x1F));
        break;
      }
    },
    roomOps: function() {
      var a = 0, b = 0, c, d, e;
      s._opcode = s.fetchScriptByte();
      switch(s._opcode & 0x1F) {
        case 3: // room screen
          a = s.getVarOrDirectWord(PARAM_1);
          b = s.getVarOrDirectWord(PARAM_2);
          s.initScreens(a, b);
        case 4: // room palette
          a = s.getVarOrDirectWord(PARAM_1);
          b = s.getVarOrDirectWord(PARAM_2);
          c = s.getVarOrDirectWord(PARAM_3);
          s._opcode = s.getVarOrDirectByte();
          d = s.getVarOrDirectByte(PARAM_1);
          // setPalColor(d, a, b, c);
        break;
        case 10: // room fase
          a = s.getVarOrDirectWord(PARAM_1);
          if(a) {
            // _switchRoomEffect
          } else {
            // fadeIn
          }
        break;
        default:
          log("unimplemented roomOps opcode " + (s._opcode & 0x1F));
        break;
      }
    },
    isEqual: function() {
      var a, b, varId;
      varId = s.fetchScriptWord();
      a = s.readVar(varId);
      b = s.getVarOrDirectWord(PARAM_1);
      s.jumpRelative(b == a);
    },
    isLess: function() {
      var a = s.getVar(), b = s.getVarOrDirectWord(PARAM_1);
      s.jumpRelative(b < a);
    },
    isNotEqual: function() {
      var a = s.getVar(), b = s.getVarOrDirectWord(PARAM_1);
      s.jumpRelative(b == a);
    },
    unimplementedOpcode: unimplementedOpcode,
    getActorMoving: function() {
    },
    stopObjectCode: function() {
      s.stopObjectCode();
    },
    notEqualZero: function() {
      var a = s.getVar();
      s.jumpRelative(a != 0);
    },
    equalZero: function() {
      var a = s.getVar();
      s.jumpRelative(a == 0);
    },
    expression: function() {
      var dst;
      s._scummStackPos = 0;
      s.getResultPos();
      dst = s._resultVarNumber;
      while((s._opcode = s.fetchScriptByte()) != 0xFF) {
        switch(s._opcode & 0x1F) {
          case 1: // varordirect
            s.push(s.getVarOrDirectWord(PARAM_1));
          break;
          case 2: // add
            i = s.pop();
            s.push(s.pop() + i);
          break;
          case 3: // sub
            i = s.pop();
            s.push(s.pop() - i);
          break;
          default:
            log("unimplemented expression opcode " + (s._opcode & 0x1F));
          break;
        }
      }
    },
    verbOps: function() {
      var verb

      verb = s.getVarOrDirectByte(PARAM_1);

      while((s._opcode = s.fetchScriptByte()) != 0xFF) {
        switch(s._opcode & 0x1F) {
          case 2: // name
          break;
          default:
            log("unimplemented verbOps opcode " + (s._opcode & 0x1F));
          break;
        }
      }
    },
    drawObject: function() {
      var state = 1, obj, idx, i, xpos = 255, ypos = 255;

      obj = s.getVarOrDirectWord(PARAM_1);
      // xpos = s.getVarOrDirectWord(PARAM_2);
      // ypos = s.getVarOrDirectWord(PARAM_3);
      // log("draw object "+obj+" x"+xpos+" y"+ypos);
      // log(s._scriptPointer.offset + " / " + s._scriptPointer.length);
      // return;
      s._opcode = s.fetchScriptByte();
      switch(s._opcode & 0x1F) {
        case 0:
        case 1:
          xpos = s.getVarOrDirectWord(PARAM_1);
          ypos = s.getVarOrDirectWord(PARAM_2);
        break;
        case 2:
          state = s.getVarOrDirectWord(PARAM_1);
        break;
        case 0x1F:
        break;
        default:
          log("unimplemented drawObject opcode " + (s._opcode & 0x1F));
        break;
      }
      // idx = s.getObjectIndex(obj);
      // if(idx == -1) return;

      // addObjectToDrawQueue(idx)
    },
    setState: function() {
      var obj, state;
      obj = s.getVarOrDirectWord(PARAM_1);
      state = s.getVarOrDirectByte(PARAM_2);
      // s.pushSatate(obj, state);
      // s.markObjAsDirty(obj);
      // if(s._bgNeedsRedraw)
      //   s.clearDrawObjectQueue();
    },
    getActorElevation: function() {
      var act;
      s.getResultPos();
      act = s.getVarOrDirectByte(PARAM_1);
      // actor stuff
    },
    drawBox: function() {
      var x,y,x2,y2, color;
      x = s.getVarOrDirectWord(PARAM_1);
      y = s.getVarOrDirectWord(PARAM_2);
      s._opcode = s.fetchScriptByte();
      x2 = s.getVarOrDirectWord(PARAM_1);
      y2 = s.getVarOrDirectWord(PARAM_2);
      color = s.getVarOrDirectByte(PARAM_3);

      // s.drawBox(x, y, x2, y2, color);
    },
    pseudoRoom: function() {
      var i = s.fetchScriptByte(), j;
      while((j = s.fetchScriptByte()) != 0) {
        if(j >= 0x80) {
          //resourceMapper stuff
        }
      }
    },
    setOwnerOf: function() {
      var obj = s.getVarOrDirectWord(PARAM_1), owner = s.getVarOrDirectByte(PARAM_2);
      // s.setOwnerOf(obj, owner);
    },
    getRandomNr: function() {
      s.getResultPos();
      s.setResult(Math.floor(Math.random()*s.getVarOrDirectByte(PARAM_1)));
    },
    actorOps: function() {
      var a = s.getVarOrDirectByte(PARAM_1);

      while((s._opcode = s.fetchScriptByte()) != 0xFF) {
        switch(s._opcode & 0x1F) {
          case 0:
          case 1: // costume
          case 3: // sound
          case 4: // walk animation
          case 6:
          case 12: // talk color
          case 16: // actor width
          case 19: // always zclip
            // unimplemented
            s.getVarOrDirectByte(PARAM_1);
          break;
          case 8: // default
          case 18: // never zclip
          case 28: // skip?
          break;
          case 13: // actor name
            s.loadPtrToResource("actor_name", a);
          break;
          default:
            log("unimplemented actorOps opcode " + (s._opcode & 0x1F));
          break;
        }
      }
    },
    breakHere: function() {
      s.updateScriptPtr();
      s._currentScript = 0xFF;
    },
    jumpRelative: function() {
      s.jumpRelative(false);
    },
    loadRoom: function() {
      var room = s.getVarOrDirectByte(PARAM_1);
      if(!room != s._currentRoom)
        s.startScene(room, 0, 0);

      s._fullRedraw = true;
    },
    print: function() {
      s._actorToPrintStrFor = s.getVarOrDirectByte(PARAM_1);
      s.decodeParseString();
    },
    putActorInRoom: function() {
      var act = s.getVarOrDirectByte(PARAM_1), room = s.getVarOrDirectByte(PARAM_2);

      // putActor
    },
    putActor: function() {
      var act = s.getVarOrDirectByte(PARAM_1), x = s.getVarOrDirectWord(PARAM_2), y = s.getVarOrDirectWord(PARAM_3);

      // putActor(x, y);
    },
    actorFollowCamera: function() {
      var act = s.getVarOrDirectByte(PARAM_1);

      // actorFollowCamera(act);
    },
    animateActor: function() {
      var act = s.getVarOrDirectByte(PARAM_1), anim = s.getVarOrDirectByte(PARAM_2);

      // animateActor
    }
  };

  s._opcodes = {
    0x00: s._opcodeCommands.stopObjectCode,
    0x05: s._opcodeCommands.drawObject,
    0x06: s._opcodeCommands.getActorElevation,
    0x07: s._opcodeCommands.setState,
    0x08: s._opcodeCommands.isNotEqual,
    0x0a: s._opcodeCommands.startScript,
    0x0c: s._opcodeCommands.resourceRoutines,
    0x13: s._opcodeCommands.actorOps,
    0x14: s._opcodeCommands.print,
    0x16: s._opcodeCommands.getRandomNr,
    0x18: s._opcodeCommands.jumpRelative,
    0x1a: s._opcodeCommands.move,
    0x2c: s._opcodeCommands.cursorCommand,
    0x26: s._opcodeCommands.setVarRange,
    0x27: s._opcodeCommands.stringOps,
    0x28: s._opcodeCommands.equalZero,
    0x33: s._opcodeCommands.roomOps,
    0x44: s._opcodeCommands.isLess,
    0x48: s._opcodeCommands.isEqual,
    0x53: s._opcodeCommands.actorOps,
    0x56: s._opcodeCommands.getActorMoving,
    0x65: s._opcodeCommands.unimplementedOpcode,
    0x69: s._opcodeCommands.setOwnerOf,
    0x72: s._opcodeCommands.loadRoom,
    0x7a: s._opcodeCommands.verbOps,
    0x80: s._opcodeCommands.breakHere,
    0x81: s._opcodeCommands.putActor,
    0x91: s._opcodeCommands.animateActor,
    0x9a: s._opcodeCommands.move,
    0xa0: s._opcodeCommands.stopObjectCode,
    0xa8: s._opcodeCommands.notEqualZero,
    0xac: s._opcodeCommands.expression,
    0xcc: s._opcodeCommands.pseudoRoom,
    0xd2: s._opcodeCommands.actorFollowCamera,
    0xed: s._opcodeCommands.putActorInRoom,
    0xff: s._opcodeCommands.drawBox
  };

}());
