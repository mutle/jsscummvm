(function(){
  var _system = ScummVM.system;

  var RES_INVALID_OFFSET = 0xFFFFFFFF;

  ScummVM.engines.SCUMM = {
    _screenWidth: 320,
    _screenHeight: 200,
    _engineStartTime: 0,
    _files: {},
    _filenames: [],
    _game: "",
    _roomoffs: [],
    _lastLoadedRoom: -1,
    init: function(game) {
      this._game = game;
    },
    setFile: function(file, data) {
      this._files[file] = new ScummVM.Stream(data);
      this._filenames.push(file);
    },
    go: function() {
      _system.loadGameFile(this._game, 0, function() {
        var t = ScummVM.engines.SCUMM;
        t._engineStartTime = _system.getMillis() / 1000;
        // window.setInterval(this.loop, 1000);
        t.readIndexFile();
      });
    },
    loop: function() {
      // this.processInput();
      // Do SCUMM stuff
    },
    readIndexFile: function() {
      var t = this, blocktype, itemsize;
      var file = t._files[t._filenames[0]];
      t.closeRoom();
      t.openRoom(0);
      while(true) {
        blocktype = file.readUI32(true);
        itemsize = file.readUI32(true);
        if(file.eof())
          break;
        t.readIndexBlock(blocktype, itemsize);
        break;
      }
    },
    readIndexBlock: function(blocktype, itemsize) {
      var MKID_BE = _system.MKID_BE;
      switch(blocktype) {
        case MKID_BE('DCHR'):
        case MKID_BE('DIRF'):
          alert("DCHR");
        break;
        case MKID_BE("DOBJ"):
          alert("DOBJ");
        break;
        case MKID_BE("DROO"):
          alert("DROO");
        break;
        case MKID_BE("DSCR"):
          alert("DSCR");
        break;
        case MKID_BE("DCOS"):
          alert("DCOS");
        break;
        case MKID_BE("DSOU"):
          alert("DSOU");
        break;
        default:
          alert("unknown block "+_system.reverse_MKID(blocktype));
        break;
      }
    },
    readRoomsOffsets: function(offset) {
      var t = this,
          file = t._files[t._filenames[0]];
      num = file.seek(offset, true).readUI8();
      while(num--) {
        room = file.readUI8();
        if(!t._roomoffs[room]) {
          t._roomoffs[room] = file.readUI32(false);
        } else {
          file.readUI32(false);
        }
        alert(room);
      }
    },
    closeRoom: function() {
      var t = this,
          file = t._files[t._filenames[0]];
      if(t._lastLoadedRoom != -1) {
        t._lastLoadedRoom = -1;
        file.reset();
      }
    },
    openRoom: function(room) {
      var t = this,
          file = t._files[t._filenames[0]];
      if(t._lastLoadedRoom == room)
        return;
      if(room == -1) {
        file.reset();
        return;
      }
      diskNumber = 0;
      room_offs = 0;

      while(room_offs != RES_INVALID_OFFSET) {
        encByte = 0;

        file.encByte = encByte;
        this.readRoomsOffsets();
        _fileOffset = this._roomoffs[room];

        if(_fileOffset != 8)
          return;

        do {
        } while(false);
      }
    }
  };
}());
