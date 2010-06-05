var PARAM_1 = 0x80, PARAM_2 = 0x40, PARAM_3 = 0x20;

(function(){
  var _system = ScummVM.system;

  function Point(x, y) {
    return {x: x, y: y};
  }

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
    _roomResource: 0,
    _lastLoadedRoom: -1,
    _nums: {},
    _objs: [],
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
    _numObjectsInRoom: 0,
    _scriptPointer: null,
    _scriptOrgPointer: null,
    _lastCodePointer: null,
    _res: null,
    _vars: {},
    _verbs: [],
    _opcodes: {},
    _scriptFile: null,
    _dumpScripts: false,
    _completeScreenRedraw: true,
    _shouldQuit: false,
    _timer: 0,
    _virtscreens: [],
    _resultVarNumber: 0,
    _string: [],
    _actorToPrintStrFor: 0,
    _roomPalette: [],
    _currentPalette: [],
    _palDirtyMin: 0,
    _palDirtyMax: 0,
    _curPalIndex: 0,
    _resourceHeaderSize: 8,
    _resourceLastSearchSize: 0,
    _resourceLastSearchBuf: null,
    _gdi: null,
    _gfx: {ENCD: 0, EXCD:0, EPAL:0, CLUT:0, PALS:0},
    _drawObjectQue: [],
    _debugMode: 0,
    _debug: false,
    _screenStartStrip: 0,
    _screenEndStrip: 0,
    _localScriptOffsets: [],
    _skipDrawObject: false,
    _texts: [],
    _charsetData: [],
    _charsetColorMap: [],
    _camera: {cur: Point(0,0), dest: Point(0,0), accel: Point(0,0), last: Point(0,0), follows: 0, mode: "normal", movingToActor:false},
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
        var diff = 0;

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
        t._timer = window.setInterval(function() {
          t.scummVar("timer", Math.floor(diff * 60 / 1000));
          t.scummVar("timer_total", t.scummVar("timer_total") + Math.floor(diff * 60 / 1000));
          var delta = t.scummVar("timer_next");
          if(delta < 1)
            delta = 1;

          t.waitForTimer(Math.floor(delta * 1000 / 60) - diff, function() {
            diff = _system.getMillis();
            t.loop(delta);
            diff = _system.getMillis() - diff;
          });


        }, 1000 / 30);
      }
    },
    waitForTimer: function(ticks, callback) {
      window.setTimeout(callback, ticks);
    },
    loop: function(delta) {
      var t = ScummVM.engines.SCUMM;

      t.scummVar("tmr_1", t.scummVar("tmr_1") + delta);
      t.scummVar("tmr_2", t.scummVar("tmr_2") + delta);
      t.scummVar("tmr_3", t.scummVar("tmr_3") + delta);

      if(delta > 15)
        delta = 15;

      t.decreaseScriptDelay(delta);

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

      if(t._currentRoom == 0) {
        t.drawDirtyScreenParts();
      } else {
        // Actors, Camera, Objects
        t.moveCamera();
        if(t._bgNeedsRedraw || t._fullRedraw)
          t.redrawBGAreas();
        t.processDrawQueue();

        if(t.scummVar("main_script")) {
          t.runScript(t.scummVar("main_script"), 0, 0, 0);
        }

        t.updatePalette();
        t.drawDirtyScreenParts();
      }

      // t._shouldQuit = true;
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
      var t = this, i;
      t.initScreens(16, 144);
      t._currentRoom = 0;
      for(i = 0; i < 256; i++)
        t._roomPalette[i] = i;
      t.resetPalette();
      t.loadCharset(1);
      // t._cursor.animate = 1;
      // actors
      t._vm.numNestedScripts = 0;
      // verbs
      // camera triggers
      // camera._follows = 0;
      t._virtscreens[0].xstart = 0;
      t._currentScript = 0xFF;
      t._currentRoom = 0;
      t._numObjectsInRoom = 0;
      t._actorToPrintStrFor = 0;
      t._fullRedraw = true;

      t.clearDrawObjectQueue();
    }
  };
}());
