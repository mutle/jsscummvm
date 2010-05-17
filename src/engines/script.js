(function() {
  var _system = ScummVM.system,
      s = ScummVM.engines.SCUMM;

  s.ScriptSlot = function() {
    var t = this;
    s.number = 0;
    s.offs = 0;
    s.status = "dead";
    s.where = 0;
    s.freezeResistant = false;
    s.recursive = false;
    s.freezeCount = 0;
    s.delayFrameCount = 0;
    s.args = [];
  };

  s.runBootscript = function() {
     var t = this, i;
     args = [];
     for(i = 0; i < 16; i++) {
       args[i] = 0;
     }
     args[0] = t._bootParam;
     t.runScript(1, 0, 0, args);
  };
  s.runScript = function(script, freezeResistant, recursive, args) {
    var t = this, slot, scriptPtr, scriptOffs, scriptType;
    if(!script) return;
    if(!recursive) t.stopScript(script);

    if(script < t._nums['global_scripts']) {
      scriptPtr = t.getResourceAddress("script", script);
      scriptOffs = 8;
      scriptType = "global";
      log("runScript(Global-"+script+")");
    } else {
      log("runScript("+script+")");
    }

    slot = t.getScriptSlot();
    slot.number = script;
    slot.offs = scriptOffs;
    slot.status = "running";
    slot.where = scriptType;
    slot.freezeResistant = freezeResistant;
    slot.recursive = recursive;
    slot.freezeCount = 0;
    slot.delayFrameCount = 0;
    slot.args = args;

    t.runScriptNested(slot);
  };

  s.runScriptNested = function(slot) {
    var t = this, nest;
    nest = {};

    if(t._currentScript == 0xFF) {
      nest.number = 0xFF;
      nest.where = 0xFF;
    } else {
      nest.number = slot.number;
      nest.where = slot.where;
      nest.slot = t._currentScript;
    }

    t._vm.nest[t._vm.numNestedScripts] = nest;
    t._vm.numNestedScripts++;
    t._currentScript = slot.number;

    log("preparing script "+slot.number);
    t.getScriptBaseAddress();
    t.getScriptEntryPoint();
    log("executing script "+slot.number);
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

  s.getScriptSlot = function(n) {
    var t = this, i, slot = null;
    if(n && n > 0) {
      window.console.log(t._vm);
      return t._vm.slot[n];
    } else {
      for(i = 1; i < t._vm.slot.length; i++) {
        slot = t._vm.slot[i];
        if(slot && slot.status == "dead")
          return slot;
      }
      slot = new s.ScriptSlot();
      t._vm.slot.push(slot);
      return slot;
    }
  };

  s.getScriptBaseAddress = function() {
    var t = this, slot;

    if(t._currentScript == 0xFF)
      return;

    log(t._currentScript);
    slot = t.getScriptSlot(t._currentScript);
    window.console.log(slot);
    log("Loading a "+slot.where+" script");
    switch(slot.where) {
      case "global":
        t._scriptOrgPointer = t.getResourceAddress("script", slot.number);
        window.console.log(t._scriptOrgPointer);
      break;
      default:
        log("Unknown script location "+slot.where);
      break;
    }
  };

  s.getScriptEntryPoint = function() {
    var t = this;
    if(t._currentScript == 0xFF)
      return;
    t._scriptPointer = t._scriptOrgPointer.streamAtOffset(t._vm.slot[t._currentScript].offs, false);
  };

  s.executeScript = function() {
    var t = this;
    while(t._currentScript != 0xFF) {
      _opcode = t.fetchScriptByte();
      log("executing opcode "+_opcode);
      // didexec
      t.executeOpcode(_opcode);
    }
  };

  s.executeOpcode = function(i) {
    var t = this,
        opcodes = t._opcodes;
    if(opcodes[i] && opcodes[i].proc)
      opcodes[i].proc();
    else {
      log("Invalid opcode "+i);
      t._currentScript = 0xFF;
    }
  };

  s.setupScummVars = function() {
    var t = this;
    t._vars["keypress"] = 0
  };

  s.setupOpcodes = function() {
  };

  s.resetScummVars = function() {
    var t = this,
        vm = t._vm;

    vm.numNestedScripts = 0;
    t._currentScript = 0xFF;
    t._currentRoom = 0;
  };

  s.fetchScriptByte = function() {
    var t = this,
        b = t._scriptOrgPointer;
    if(b)
      return b.readUI8();
    return null;
  };

}());
