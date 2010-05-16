(function(){
  var _system = ScummVM.system;

  ScummVM.engines.SCUMM = {
    _screenWidth: 320,
    _screenHeight: 200,
    _engineStartTime: 0,
    _files: {},
    _filenames: [],
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
    init: function(game) {
      this._game = game;
    },
    setFile: function(file, data) {
      stream = new ScummVM.Stream(data);
      stream.encByte = 0x69;
      this._files[file] = stream;
      this._filenames.push(file);
    },
    go: function() {
      var t = this;
      _system.loadGameFile(this._game, 0, function() {
        t._engineStartTime = _system.getMillis() / 1000;
        // window.setInterval(this.loop, 1000);
        t.readIndexFile();
        t.runBootscript();
      });
    },
    loop: function() {
      // this.processInput();
      // Do SCUMM stuff
    },
    runBootscript: function() {
       var t = this, i;
       args = [];
       for(i = 0; i < 16; i++) {
         args[i] = 0;
       }
       args[0] = t._bootParam;
       runScript(1, 0, 0, args);
    },
    runScript: function(script, freezeResistant, recursive, args) {
      var t = this;
      if(!script) return;
      if(!recursive) t.stopScript(script);

      if(script < t._nums['global_scripts']) {
      } else {
      }
    }
  };
}());
