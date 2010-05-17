(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM,
      NUM_SCRIPT_SLOT = 80;

  s.ScriptSlot = function(slot) {
    var t = this;
    t.number = 0;
    t.offs = 0;
    t.status = "dead";
    t.where = 0;
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
    t.where = 0;
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
    log("running script "+script);
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
    nest = t._vm.nest[t._vm.numNestedScripts];
    log("running script nested "+slot.number);

    if(t._currentScript == 0xFF) {
      nest.number = 0xFF;
      nest.where = 0xFF;
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

  s.stopScript = function(script) {
    var t = this, i, slot, nest,
        slots = t._vm.slot;
    log("stopping script "+script);
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
        nest.where = 0xFF;
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

    slot = t._vm.slot[t._currentScript]
    slot = t.getScriptSlot(t._currentScript);
    debug(5, "Loading a "+slot.where+" script");
    switch(slot.where) {
      case "global":
        t._scriptOrgPointer = t.getResourceAddress("script", slot.number);
        t._lastCodePointer = t._scriptOrgPointer.newRelativeStream(0);
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
    log("executing begin "+t._currentScript);
    while(t._currentScript != 0xFF) {
      log("executing "+t._currentScript);
      _opcode = t.fetchScriptByte();
      t._vm.slot[t._currentScript].didexec = true;

      debug(5, "executing opcode 0x"+_opcode.toString(16));
      t.executeOpcode(_opcode);
    }
    log("execute done");
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
    t._vars["keypress"] = 0
  };

  s.resetScummVars = function() {
    var t = this,
        vm = t._vm;

    vm.numNestedScripts = 0;
    t._currentScript = 0xFF;
    t._currentRoom = 0;
  };

  s.jumpRelative = function(cond) {
    var t = this, offset = t.fetchScriptWord();
    if(!cond)
      t._scriptPointer.seek(offset);
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

  s.fetchScriptByte = function() {
    var t = this, b = t._scriptPointer;
    return b.readUI8();
  };

  s.fetchScriptWord = function() {
    var t = this, b = t._scriptPointer;
    return b.readUI16();
  };

  s.fetchScriptWordSigned = function() {
    var t = this, b = t._scriptPointer;
    return b.readSI16();
  };

  s.fetchScriptDWord = function() {
    var t = this, b = t._scriptPointer;
    return b.readUI32();
  };

  s.fetchScriptDWordSigned = function() {
    var t = this, b = t._scriptPointer;
    return b.readSI32();
  };

  var unimplementedOpcode = function() {
    log("opcode unimplemented");
  };

  s._opcodes = {
    0x00: function() { // stopObjectCode
    },
    0x0a: function() { //startScript
      var op, script, data;

      op = s._opcode;
      script = s.getVarOrDirectByte(PARAM_1);
      data = s.getWordVararg();

      log("about to run script "+script);

      s.runScript(script, (op & 0x20) != 0, (op & 0x40) != 0, data);
    },
    0x0c: function() { // resourceRoutines
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
       case 18: // charset
         s.loadCharset(resid);
       break;
       default:
         error("unimplemented resourceRoutines opcode "+op);
       break;
     }
    },
    0x1a: function() { // move
      s.getResultPos();
      s.setResult(s.getVarOrDirectWord(PARAM_1));
    },
    0x2c: function() { // cursorCommand
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
    0x26 : function() { // setVarRange
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
    0x27: function() { // stringOps
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
    0x33: function() { // roomOps
      var a = 0, b = 0, c, d, e;
      s._opcode = s.fetchScriptByte();
      switch(s._opcode & 0x1F) {
        case 4: // room palette
          a = s.getVarOrDirectWord(PARAM_1);
          b = s.getVarOrDirectWord(PARAM_2);
          c = s.getVarOrDirectWord(PARAM_3);
          s._opcode = s.getVarOrDirectByte();
          d = s.getVarOrDirectByte(PARAM_1);
          // setPalColor(d, a, b, c);
        break;
        default:
          log("unimplemented roomOps opcode " + (s._opcode & 0x1F));
        break;
      }
    },
    0x48: function() { // isEqual
      var a, b, varId;
      varId = s.fetchScriptWord();
      a = s.readVar(varId);
      b = s.getVarOrDirectWord(PARAM_1);
      s.jumpRelative(b == a);
    },
    0x4c: unimplementedOpcode, // soundKludge
    0x56: function() { //getActorMoving
      log("actor moving");
    },
    0x65: function() {
    },
    0xa0: function() { // stopObjectCode
      s.stopObjectCode();
    },
    0xa8: function() { // notEqualZero
      var a = s.getVar();
      s.jumpRelative(a == 0);
    },
    0xac: function() { // expression
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
    }
  };

}());
