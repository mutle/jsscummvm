(function(){
  var _system = ScummVM.system;

  var RES_INVALID_OFFSET = 0xFFFFFFFF,
      OF_OWNER_MASK = 0x0F,
      OF_STATE_MASK = 0xF0,
      OF_STATE_SHL = 4,


  var s = ScummVM.engines.SCUMM;

  s.readIndexFile = function() {
    var t = this, blocktype, itemsize,
        numblock = 0,
        MKID_BE = _system.MKID_BE;
    var file = t._files[t._filenames[0]];

    // t.closeRoom();
    // t.openRoom(0);
    while(true) {
      blocktype = file.readUI32(true);
      itemsize = file.readUI32(true);
      // log(_system.reverse_MKID(blocktype)+ " "+itemsize);
      if(file.eof()) break;

      switch(blocktype) {
      case MKID_BE("DOBJ"):
        this._nums['global_objects'] = file.readUI16(false);
        itemsize -= 2;
      break;
      case MKID_BE("DROO"):
        this._nums['rooms'] = file.readUI16(false);
        itemsize -= 2;
      break;
      case MKID_BE("DSCR"):
        this._nums['scripts'] = file.readUI16(false);
        itemsize -= 2;
      break;
      case MKID_BE("DCOS"):
        this._nums['costumes'] = file.readUI16(false);
        itemsize -= 2;
      break;
      case MKID_BE("DSOU"):
        this._nums['sounds'] = file.readUI16(false);
        itemsize -= 2;
      break;
      // default:
      //   log("unknown block "+_system.reverse_MKID(blocktype));
      // break;
      }
      file.seek(itemsize - 8);
    }
    file.reset();
    while(true) {
      blocktype = file.readUI32(true);
      itemsize = file.readUI32(true);
      // log(_system.reverse_MKID(blocktype)+ " "+itemsize);

      if(file.eof()) break;

      numblock++;
      t.readIndexBlock(file, blocktype, itemsize);
    }
    t.closeRoom();
    log("Finished loading index file");
  };

  s.readIndexBlock = function(file, blocktype, itemsize) {
    var t = this,
        MKID_BE = _system.MKID_BE;
    switch(blocktype) {
      case MKID_BE('DCHR'):
      case MKID_BE('DIRF'):
        t.readResTypeList(file, "charset");
      break;
      case MKID_BE("DOBJ"):
        t.readGlobalObjects(file);
      break;
      case MKID_BE("RNAM"):
        // Unused
        for(var room; room = file.readUI8(); ) {
          file.readString(9)
          // name = _system.xorString(file.readString(9), 0xFF);
          // log("Room "+room+": "+name);
        }
      break;
      case MKID_BE("DROO"):
      case MKID_BE("DIRR"):
        t.readResTypeList(file, "room");
      break;
      case MKID_BE("DSCR"):
      case MKID_BE("DIRS"):
        t.readResTypeList(file, "script");
      break;
      case MKID_BE("DCOS"):
      case MKID_BE("DIRC"):
        t.readResTypeList(file, "costume");
      break;
      case MKID_BE("MAXS"):
        t.readMAXS(file, itemsize);
      break;
      case MKID_BE("DIRN"):
      case MKID_BE("DSOU"):
        t.readResTypeList(file, "sound");
      break;
      case MKID_BE("AARY"):
        log("AARY unsupported");
      break;
      default:
        log("unknown block "+_system.reverse_MKID(blocktype));
      break;
    }
  };

  s.readRoomsOffsets = function(offset) {
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
      log(room);
    }
  };

  s.closeRoom = function() {
    var t = this,
        file = t._files[t._filenames[0]];
    if(t._lastLoadedRoom != -1) {
      t._lastLoadedRoom = -1;
      file.reset();
    }
  };

  s.openRoom = function(room) {
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
      this.readRoomsOffsets();
      _fileOffset = this._roomoffs[room];

      if(_fileOffset != 8)
        return;

      do {
      } while(false);
    }
  };

  s.readResTypeList = function(file, type) {
    var t = this;
    var num, i;
    num = file.readUI16();

    if(!t._roomno[type]) t._roomno[type] = [];
    if(!t._roomoffs[type]) t._roomoffs[type] = [];

    for(i = 0; i < num; i++) {
      t._roomno[type][i] = file.readUI8();
    }
    for(i = 0; i < num; i++) {
      t._roomoffs[type][i] = file.readUI32();
    }
  };

  s.readMAXS = function(file, itemsize) {
    var t = this;
    t._nums['variables'] = file.readUI16();
    file.readUI16(); // Skip
    t._nums['bit_variables'] = file.readUI16();
    t._nums['local_objects'] = file.readUI16();
    t._nums['array'] = 50;
    t._nums['verbs'] = 100;
    t._nums['new_names'] = 130;
    t._objectRoomTable = null;
    file.readUI16(); // Skip
    t._nums['charsets'] = file.readUI16();
    file.readUI16(); // Skip
    file.readUI16(); // Skip
    t._nums['inventory'] = file.readUI16();
    t._nums['global_scripts'] = 200;
    t._nums['shadow_pallete_size'] = 256;
    t._nums['fl_object'] = 50;
  };

  s.readGlobalObjects = function(file) {
    var t = this, i, num;

    num = file.readUI16();
    assert(num == t._nums['global_objects']);
    for(i = 0; i < num; i++) {
      v = file.readUI8();
      t._objectStateTable[i] = v >> OF_STATE_SHL;
      t._objectOwnerTable[i] = v & OF_OWNER_MASK;
    }
    for(i = 0; i < num; i++) {
      t._classData[i] = file.readUI32();
    };
  };

}());

