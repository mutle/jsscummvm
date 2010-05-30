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
    t.delay = 0;
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
    t.cutSceneStackPointer = 0;
    t.cutScenePtr = [];
    t.cutSceneScript = [];

    for(var i = 0; i < 80; i++) {
      if(i < 15)
        t.nest[i] = new s.NestedScript();
      t.slot[i] = new s.ScriptSlot(i);
      t.localvar[i] = [];
    }
  }

  s.scummVar = function(name,value) {
    var t = this;
    if(typeof value != "undefined")
      t._scummVars[t._vars[name]] = value;
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
      scriptOffs = t._localScriptOffsets[script - t._nums['global_scripts']];
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

  s.stopObjectScript = function(slot) {
  };

  s.runExitScript = function() {
    var t = this, script = 0;
    if(script = t.scummVar("exit_script")) {
      log("Exit script");
      t.runScript(script, 0, 0, 0);
    }

    if(script = t.scummVar("exit_script2")) {
      t.runScript(script, 0, 0, 0);
    }
  };

  s.runEntryScript = function() {
    var t = this;
    if(script = t.scummVar("entry_script")) {
      t.runScript(script, 0, 0, 0);
    }
    if(t._gfx["ENCD"]) {
      slot = t.getScriptSlot();
      slot.status = "running";
      slot.number = 10002;
      slot.where = "room";
      slot.offs = t._gfx["ENCD"].offset;
      slot.freezeResistant = 0;
      slot.freezeCount = 0;
      slot.delayFrameCount = 0;
      slot.cycle = 1;
      t.initializeLocals(slot.slot, []);
      t.runScriptNested(slot);
    }
    if(script = t.scummVar("entry_script2")) {
      t.runScript(script, 0, 0, 0);
    }
  };

  s.decreaseScriptDelay = function(amount) {
    var t = this, slots = t._vm.slot, i;
    for(i = 0; i < slots.length; i++) {
      slot = slots[i];
      if(slot.status == "paused") {
        slot.delay -= amount;
        if(slot.delay < 0) {
          slot.status = "running";
          slot.delay = 0;
        }
      }
    }
  };

  s.isScriptRunning = function(script) {
    var t = this, slots = t._vm.slot, i;
    for(i = 0; i < slots.length; i++) {
      slot = slots[i];
      if(slot.number == script && (slot.where == "global" || slot.where == "local") && slot.status != "dead")
        return true;
    }
    return false;
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
      case "local":
      case "room":
        t._scriptOrgPointer = t.getResourceAddress("room", t._roomResource);
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

  s.getVerbEntryPoint = function(obj, entry) {
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
      t._opcode = t.fetchScriptByte();
      slot.didexec = true;

      // debug(5, "executing opcode 0x"+t._opcode.toString(16));
      t.executeOpcode(t._opcode);
    }
  };

  s.executeOpcode = function(i) {
    var t = this,
        opcodes = t._opcodes;
    if(opcodes[i]) {
      t._opcode = i;
      // log("Executing opcode 0x"+i.toString(16)+" at 0x"+(t._scriptPointer.offset - 9).toString(16)+" in script "+t._vm.slot[t._currentScript].number);
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
      ego: 1,
      camera_pos_x: 2,
      camera_pos_y: 3,
      room: 4,
      override: 5,
      machine_speed: 6,
      num_actor: 8,
      current_lights: 9,
      currentdrive: 10,
      tmr_1: 11,
      tmr_2: 12,
      tmr_3: 13,
      music_timer: 14,
      actor_range_min: 15,
      actor_range_max: 16,
      camera_min_x: 17,
      camera_max_x: 18,
      timer_next: 19,
      virt_mouse_x: 20,
      virt_mouse_y: 21,
      room_resource: 22,
      last_sound: 23,
      cutseneexit_key: 24,
      talk_actor: 25,
      camera_fast_x: 26,
      scroll_script: 27,
      entry_script: 28,
      entry_script2: 29,
      exit_script: 30,
      exit_script2: 31,
      verb_script: 32,
      sentence_script: 33,
      inventory_script: 34,
      cutscene_start_script: 35,
      cutscene_end_script: 36,
      charinc: 37,
      walkto_obj: 38,
      debugmode: 39,
      heapspace: 40,
      restart_key: 42,
      pause_key: 43,
      mouse_x: 44,
      mouse_y: 45,
      timer: 46,
      timer_total: 47,
      soundcard: 48,
      videomode: 49,
      mainmenu_key: 50,
      fixeddisk: 51,
      cursorstate: 52,
      userput: 53,
      talk_string_y: 54,
      soundresult: 56,
      talkstop_key: 57,
      fade_delay: 59,
      nosubtitles: 60,
      soundparam: 64,
      soundparam2: 65,
      soundparam3: 66,
      inputmode: 67,
      memory_performance: 68,
      video_performance: 69,
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
    t.scummVar("talk_string_y", -0x50);
    t.scummVar("videomode", 19);
    t.scummVar("fixeddisk", 1);
    t.scummVar("inputmode", 3);

    t.scummVar("debugmode", t._debugMode);
    t.scummVar("fade_delay", 3);
    t.scummVar("charinc", 4);

    // t.setTalkingActor(0);

    // Setup Light
    t._scummVars[74] = 1225; // Monkey1 specific
  };

  s.getObjectIndex = function(obj) {
    var t = this, i;
    log("getObjectIndex "+obj);
    if(obj < 1)
      return -1;
    for(i = t._objs.length; i > 0; i--) {
      if(t._objs[i] && t._objs[i].obj_nr > 0) window.console.log(t._objs[i]);
      if(t._objs[i] && t._objs[i].obj_nr == obj)
        return i;
    }
    return -1;
  };

  s.getState = function(obj) {
    var t = this;
    return t._objectStateTable[obj];
    log("image state "+state);
  };

  s.putState = function(obj, state) {
    var t = this;
      log("put State "+obj+" "+state);
    t._objectStateTable[obj] = state;
  };

  s.jumpRelative = function(cond) {
    var t = this, offset = t.fetchScriptWordSigned();
    if(!cond) {
      t._scriptPointer.seek(offset);
    }
  };

  s.push = function(a) {
    var t = this;
    t._vmstack[t._scummStackPos++] = a;
  };

  s.pop = function() {
    var t = this;
    return t._vmstack[--t._scummStackPos];
  };

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
  };

  s.resStrLen = function(stream) {
    var t = this, chr, num = 0;
    if(!stream)
      stream = t._scriptPointer;
    seekStream = stream.newRelativeStream(0);
    while((chr = seekStream.readUI8()) != 0) {
      num++;
    }
    return num;
  };

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
    var t = this, data = [], i;

    for(i = 0; i < 16; i++) {
      data[i] = String.fromCharCode(0);
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

  s.convertMessageToString = function(msg) {
    var t = this, dst = "", i, chr;

    if(!msg) return;

    for(i = 0; i < msg.length; i++) {
      chr = msg.charCodeAt(i);
      if(chr == 0) break;
      if(chr == 0xFF) {
        chr = msg.charCodeAt(++i);
        if(chr == 1 || chr == 2 || chr == 3 || chr == 8) {
          dst += String.fromCharCode(0xFF);
          dst += String.fromCharCode(chr);
        } else {
          log("special string codes");
        }
      } else {
        if(String.fromCharCode(chr) != "@")
          dst += String.fromCharCode(chr);
      }
    }
    return dst;
  };

  s.printString = function(slot, source, len) {
    var t = this, msg = source.readString(len);
    log("PRINT "+slot+": "+s.convertMessageToString(msg));
  };

  s.beginOverride = function() {
    var t = this, vm = t._vm, idx = vm.cutSceneStackPointer;
    vm.cutScenePtr[idx] = t._scriptPointer.offset;
    vm.cutSceneScript[idx] = t._scriptPointer;

    t.fetchScriptByte();
    t.fetchScriptWord();
    t.scummVar("override", 0);
  };

  s.endOverride = function() {
    var t = this, vm = t._vm, idx = vm.cutSceneStackPointer;

    vm.cutScenePtr[idx] = 0;
    vm.cutSceneScript[idx] = null;
    t.scummVar("override", 0);
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
          len = t.resStrLen();
          var old_off = t._scriptPointer.offset;
          t.printString(textSlot, t._scriptPointer, len);
          t._scriptPointer.seek(1);
        return;
        default:
          log("unimplemented decodeParseString opcode " + (s._opcode & 0x0F));
        break;
      }
    }
  };

  var unimplementedOpcode = function() {
    // log("opcode 0x"+s._opcode.toString(16)+" unimplemented");
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
        case 2: // off
        case 3: // userput on
        case 4: // userput off
        break;
        case 13: // charset set
          no = s.getVarOrDirectByte(PARAM_1);
          // s.initCharset();
        break;
        case 14: // unknown
          table = s.getWordVararg();
          // colormap Stuff
        default:
          if(s._opcodeCommands & 0x1F <= 14)
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
          log("set screen "+a+" "+b);
        break;
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
    isGreater: function() {
      var a = s.getVar(), b = s.getVarOrDirectWord(PARAM_1);
      s.jumpRelative(b > a);
    },
    isGreaterEqual: function() {
      var a = s.getVar(), b = s.getVarOrDirectWord(PARAM_1);
      s.jumpRelative(b >= a);
    },
    isLess: function() {
      var a = s.getVar(), b = s.getVarOrDirectWord(PARAM_1);
      s.jumpRelative(b < a);
    },
    isLessEqual: function() {
      var a = s.getVar(), b = s.getVarOrDirectWord(PARAM_1);
      s.jumpRelative(b <= a);
    },
    isNotEqual: function() {
      var a = s.getVar(), b = s.getVarOrDirectWord(PARAM_1);
      s.jumpRelative(b != a);
    },
    unimplementedOpcode: unimplementedOpcode,
    getActorMoving: function() {
      var act;
      s.getResultPos();
      act = s.getVarOrDirectByte(PARAM_1);
      s.setResult(0);
      // Moving
    },
    getActorFacing: function() {
      var act;
      s.getResultPos();
      act = s.getVarOrDirectByte(PARAM_1);
      s.setResult(0);
      // Facing
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
          case 4: // mul
            i = s.pop();
            s.push(i * s.pop());
          break;
          case 5: // div
            i = s.pop();
            if(i == 0)
              error("Divide by zero");
            s.push(s.pop() / i);
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
      slot = 0;
      while((s._opcode = s.fetchScriptByte()) != 0xFF) {
        switch(s._opcode & 0x1F) {
          case 6: // on
          case 7: // off
          case 9: // new
          case 17: // dim
          case 19: // center
          break;
          case 2: // name
            s.loadPtrToResource("verb", slot++);
          break;
          case 5: // verb at
            left = s.getVarOrDirectWord(PARAM_1);
            top = s.getVarOrDirectWord(PARAM_2);
          break;
          case 22: // assign object
            s.getVarOrDirectWord(PARAM_1);
            s.getVarOrDirectByte(PARAM_2);
          break;
          case 3: // verb color
          case 4: // verb hicolor
          case 18: // verb key
          case 23: // set back color
            s.getVarOrDirectByte(PARAM_1);
          break;
          default:
            log("unimplemented verbOps opcode " + (s._opcode & 0x1F));
          break;
        }
      }
    },
    drawObject: function() {
      var state = 1, obj, idx, i, xpos = 255, ypos = 255, x, y, w, h, od;

      obj = s.getVarOrDirectWord(PARAM_1);
      s._opcode = s.fetchScriptByte();
      switch(s._opcode & 0x1F) {
        case 0:
          xpos = s.getVarOrDirectWord(PARAM_1);
          ypos = s.getVarOrDirectWord(PARAM_2);
          log("drawObject "+obj+" opcode 0 "+xpos+"/"+ypos);
        break;
        case 1: // draw at
          xpos = s.getVarOrDirectWord(PARAM_1);
          ypos = s.getVarOrDirectWord(PARAM_2);
        break;
        case 2: // set state
          state = s.getVarOrDirectWord(PARAM_1);
        break;
        case 0x1F:
        break;
        default:
          log("unimplemented drawObject opcode " + (s._opcode & 0x1F));
        break;
      }
      idx = s.getObjectIndex(obj);
      if(idx == -1) return;

      od = s._objs[idx];
      if(xpos != 0xFF) {
        // Pos stuff
      }
      s.addObjectToDrawQueue(idx);

      x = od.x_pos; y = od.y_pos; w = od.width; h = od.height;

      i = s._objs.length - 1;
      do {
        o = s._objs[i];
        if(o && o.obj_nr && o.x_pos == x && o.y_pos == y && o.width == w && o.height == h) {
          s.putState(o.obj_nr, 0);
        }
      } while(--i);
      s.putState(obj, state);
    },
    setState: function() {
      var obj, state;
      obj = s.getVarOrDirectWord(PARAM_1);
      state = s.getVarOrDirectByte(PARAM_2);
      s.putState(obj, state);
      s.markObjectRectAsDirty(obj);
      if(s._bgNeedsRedraw)
        s.clearDrawObjectQueue();
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
          case 15: // skip?
          case 18: // never zclip
          case 28: // skip?
          break;
          case 5: // talk animation
            talkStartFrame = s.getVarOrDirectByte(PARAM_1);
            talkStopFrame = s.getVarOrDirectByte(PARAM_2);
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
      slot = s._vm.slot[s._currentScript];
      // log("break script "+slot.number+" slot "+s._currentScript);
      s._currentScript = 0xFF;
    },
    jumpRelative: function() {
      s.jumpRelative(false);
    },
    loadRoom: function() {
      var room = s.getVarOrDirectByte(PARAM_1);
      if(room != s._currentRoom)
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
    },
    cutscene: function() {
      var args = s.getWordVararg();
      // begin cutscene
    },
    endCutscene: function() {
      // end cutscene
    },
    isScriptRunning: function() {
      s.getResultPos();
      var script = s.getVarOrDirectByte(PARAM_1), running = s.isScriptRunning(script);
      s.setResult(running);
    },
    setCameraAt: function() {
      s.getVarOrDirectWord(PARAM_1);
      s._screenEndStrip = s._gdi.numStrips - 1;
      // set camera
    },
    startSound: function() {
      var sound = s.getVarOrDirectByte(PARAM_1);
      s.scummVar("music_timer", 0);
      // addSoundToQueue
    },
    stopSound: function() {
      var sound = s.getVarOrDirectByte(PARAM_1);
      // stopSound
    },
    faceActor: function() {
      var act = s.getVarOrDirectByte(PARAM_1), obj = s.getVarOrDirectWord(PARAM_2);
      // a.faceToObject(obj)
    },
    systemOps: function() {
      var subOp = s.fetchScriptByte();
      switch(subOp) {
        default:
          log("unimplemented systemOps opcode " + subOp);
      }
      // a.faceToObject(obj)
    },
    and: function() {
      var a;
      s.getResultPos();
      a = s.getVarOrDirectWord(PARAM_1);
      s.setResult(s.readVar(s._resultVarNumber) & a);
    },
    getVerbEntryPoint: function() {
      var a, b;
      s.getResultPos();
      a = s.getVarOrDirectWord(PARAM_1);
      b = s.getVarOrDirectWord(PARAM_2);
      s.setResult(s.getVerbEntryPoint(a, b));
    },
    getDist: function() {
      var a, b;
      s.getResultPos();
      a = s.getVarOrDirectWord(PARAM_1);
      b = s.getVarOrDirectWord(PARAM_2);
      // getObjActToObjActDist
      s.setResult(1);
    },
    walkActorToObject: function() {
      var a, obj;
      a = s.getVarOrDirectByte(PARAM_1);
      obj = s.getVarOrDirectWord(PARAM_2);
      // walk
    },
    panCameraTo: function() {
      var a = s.getVarOrDirectWord(PARAM_1);
      // panCameraTo(a, 0);
    },
    lights: function() {
      var a = s.getVarOrDirectByte(PARAM_1), b = s.fetchScriptByte(), c = s.fetchScriptByte();
      if(c == 0)
        s._scummVars['current_lights'] = a;
      else if(c == 1) {
        // flashlight
      }
      s._fullRedraw = true;
    },
    increment: function() {
      s.getResultPos();
      s.setResult(s.readVar(s._resultVarNumber) + 1);
    },
    doSentence: function() {
      var verb = s.getVarOrDirectByte(PARAM_1);
      if(verb == 0xFE) {
        s._sentenceNum = 0;
        s.stopScript(s.scummVar("sentence_script"));
        // s.clearClickedStatus();
        return;
      }
      var objectA = s.getVarOrDirectWord(PARAM_2), objectB = s.getVarOrDirectWord(PARAM_3);
      // s.doSetence(ver, objectA, objectB);
    },
    delay: function() {
      var delay = s.fetchScriptByte();
      delay |= s.fetchScriptByte() << 8;
      delay |= s.fetchScriptByte() << 16;
      s._vm.slot[s._currentScript].delay = delay;
      s._vm.slot[s._currentScript].status = "paused";
      s._opcodeCommands.breakHere();
    },
    walkActorToActor: function() {
      var nr = s.getVarOrDirectByte(PARAM_1),
          nr2 = s.getVarOrDirectByte(PARAM_2),
          dist = s.fetchScriptByte();

    },
    startMusic: function() {
      var sound = s.getVarOrDirectByte(PARAM_1);
    },
    beginOverride: function() {
      if(s.fetchScriptByte() != 0)
        s.beginOverride();
      else
        s.endOverride();
    },
    getObjectState: function() {
      s.getResultPos();
      s.setResult(s.getState(s.getVarOrDirectWord(PARAM_1)));
    }
  };

  s._opcodes = {
    0x00: s._opcodeCommands.stopObjectCode,
    0x01: s._opcodeCommands.putActor,
    0x02: s._opcodeCommands.startMusic,
    0x05: s._opcodeCommands.drawObject,
    0x06: s._opcodeCommands.getActorElevation,
    0x07: s._opcodeCommands.setState,
    0x08: s._opcodeCommands.isNotEqual,
    0x09: s._opcodeCommands.faceActor,
    0x0a: s._opcodeCommands.startScript,
    0x0b: s._opcodeCommands.getVerbEntryPoint,
    0x0c: s._opcodeCommands.resourceRoutines,
    0x0f: s._opcodeCommands.getObjectState,
    0x12: s._opcodeCommands.panCameraTo,
    0x13: s._opcodeCommands.actorOps,
    0x14: s._opcodeCommands.print,
    0x16: s._opcodeCommands.getRandomNr,
    0x17: s._opcodeCommands.and,
    0x18: s._opcodeCommands.jumpRelative,
    0x19: s._opcodeCommands.doSentence,
    0x1a: s._opcodeCommands.move,
    0x1c: s._opcodeCommands.startSound,
    0x20: s._opcodeCommands.unimplementedOpcode,
    0x2c: s._opcodeCommands.cursorCommand,
    0x2e: s._opcodeCommands.delay,
    0x26: s._opcodeCommands.setVarRange,
    0x27: s._opcodeCommands.stringOps,
    0x28: s._opcodeCommands.equalZero,
    0x32: s._opcodeCommands.setCameraAt,
    0x33: s._opcodeCommands.roomOps,
    0x3c: s._opcodeCommands.stopSound,
    0x40: s._opcodeCommands.cutscene,
    0x44: s._opcodeCommands.isLess,
    0x46: s._opcodeCommands.increment,
    0x48: s._opcodeCommands.isEqual,
    0x4d: s._opcodeCommands.walkActorToActor,
    0x4f: s._opcodeCommands.unimplementedOpcode,
    0x52: s._opcodeCommands.actorFollowCamera,
    0x53: s._opcodeCommands.actorOps,
    0x56: s._opcodeCommands.getActorMoving,
    0x58: s._opcodeCommands.beginOverride,
    0x63: s._opcodeCommands.getActorFacing,
    0x65: s._opcodeCommands.unimplementedOpcode,
    0x68: s._opcodeCommands.isScriptRunning,
    0x69: s._opcodeCommands.setOwnerOf,
    0x70: s._opcodeCommands.lights,
    0x72: s._opcodeCommands.loadRoom,
    0x74: s._opcodeCommands.getDist,
    0x76: s._opcodeCommands.walkActorToObject,
    0x78: s._opcodeCommands.isGreater,
    0x7a: s._opcodeCommands.verbOps,
    0x80: s._opcodeCommands.breakHere,
    0x81: s._opcodeCommands.putActor,
    0x91: s._opcodeCommands.animateActor,
    0x98: s._opcodeCommands.systemOps,
    0x9a: s._opcodeCommands.move,
    0xa0: s._opcodeCommands.stopObjectCode,
    0xa8: s._opcodeCommands.notEqualZero,
    0xac: s._opcodeCommands.expression,
    0xad: s._opcodeCommands.putActorInRoom,
    0xc0: s._opcodeCommands.endCutscene,
    0xcc: s._opcodeCommands.pseudoRoom,
    0xd2: s._opcodeCommands.actorFollowCamera,
    0xed: s._opcodeCommands.putActorInRoom,
    0xfa: s._opcodeCommands.verbOps,
    0xff: s._opcodeCommands.drawBox
  };

}());
