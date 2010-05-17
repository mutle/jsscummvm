(function(){
  var _system = ScummVM.system;

  ScummVM.engines.SCUMM = {
    _screenWidth: 320,
    _screenHeight: 200,
    _engineStartTime: 0,
    _files: [],
    _file: null,
    _filenames: {},
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
    _vm: {slot:[0], nest:[], numNestedScripts: 0},
    _currentScript: 0xFF,
    _currentRoom: 0,
    _scriptPointer: null,
    _scriptOrgPointer: null,
    _res: null,
    _vars: {},
    _verbs: [],
    _opcodes: {},
    _scriptFile: null,
    _roomResource: 0,
    _dumpScripts: false,
    init: function(game) {
      this._game = game;
    },
    setFile: function(file_no, filename, data) {
      stream = new ScummVM.Stream(data);
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

        // window.setInterval(this.loop, 1000);
        t.setupScumm();
        t.readIndexFile();
        t.resetScumm();
        t.resetScummVars();
        t.runBootscript();
        window.console.log(t);
      }
    },
    loop: function() {
      // this.processInput();
      // Do SCUMM stuff
    },
    setupScumm: function() {
      var t = this;
      t.setupScummVars();
      t.setupOpcodes();
    },
    resetScumm: function() {
    }
  };
}());
