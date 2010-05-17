var PARAM_1 = 0x80, PARAM_2 = 0x40, PARAM_3 = 0x20;

(function(){
  var _system = ScummVM.system;


  ScummVM.engines.SCUMM = {
    _screenWidth: 320,
    _screenHeight: 200,
    _engineStartTime: 0,
    _files: [],
    _file: null,
    _filenames: {},
    _fileOffset: 0,
    _game: "",
    _roomoffs: {},
    _roomno: {},
    _lastLoadedRoom: -1,
    _nums: {},
    _objectRoomTable: [],
    _objectOwnerTable: [],
    _objectStateTable: [],
    _classData: [],
    _bootParam: 0,
    _scummVars: [],
    _scummStackPos: 0,
    _bitVars: [],
    _vm: null,
    _vmstack: [],
    _currentScript: 0xFF,
    _currentRoom: 0,
    _scriptPointer: null,
    _scriptOrgPointer: null,
    _lastCodePointer: null,
    _res: null,
    _vars: {},
    _verbs: [],
    _opcodes: {},
    _scriptFile: null,
    _roomResource: 0,
    _dumpScripts: false,
    _completeScreenRedraw: true,
    _shouldQuit: false,
    _timer: 0,
    _virtscreens: [],
    _resultVarNumber: 0,
    init: function(game) {
      this._game = game;
      this.initGraphics();
    },
    setFile: function(file_no, filename, data) {
      stream = new ScummVM.Stream(data, filename);
      stream.encByte = 0x69;
      this._files[file_no] = stream;
      this._filenames[filename] = file_no;
    },
    go: function() {
      var t = this;
      _system.loadGameFiles(this._game, [0, 1], function() {
          t.launch();
      });
    },
    launch: function() {
      var t = this;
      if(t._files.length > 1) {
        log("All files loaded");
        t._file = t.indexFile();
        t._engineStartTime = _system.getMillis() / 1000;
        t._res = new t.ResourceManager(t);

        t.setupScumm();
        t.readIndexFile();
        t.resetScumm();
        t.resetScummVars();
        t.runBootscript();

        log("booted");
        t._timer = window.setInterval(t.loop, 1000);
      }
    },
    loop: function() {
      var t = ScummVM.engines.SCUMM;

      return;

      // this.processInput();
      // Do SCUMM stuff
      if(t._completeScreenRedraw) {
        // Draw Verbs
        t._completeScreenRedraw = false;
        t._fullRedraw = true;
      }

      t.runAllScripts();
      // Verbs
      if(t.shouldQuit()) {
        window.clearInterval(t._timer);
        return;
      }

      log(t._currentRoom);
      if(t._currentRoom == 0) {
        t.drawDirtyScreenParts();
      } else {
        // Actors, Camera, Objects
        t.updatePalette();
        t.drawDirtyScreenParts();
      }

      t._shouldQuit = true;
    },
    shouldQuit: function() {
      var t = ScummVM.engines.SCUMM;
      if(t._shouldQuit) return true;
      return false;
    },
    setupScumm: function() {
      var t = this, res = t._res;

      res.allocResTypeData("buffer", 0, 10, "buffer", 0);
      t.setupScummVars();
      t._vm = new t.VirtualMachineState();
    },
    resetScumm: function() {
      var t = this;
      t.initScreens(16, 144);
    }
  };
}());
