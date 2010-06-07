(function(){
  var _system = ScummVM.system;

  var resourceTypes = ["charset", "room", "room_image", "room_script", "script", "costume", "sound", "buffer", "string", "actor_name", "object_name", "inventory", "scale_table", "verb", "fl_object", "matrix", "image"];

  var RES_INVALID_OFFSET = 0xFFFFFFFF,
      OF_OWNER_MASK = 0x0F,
      OF_STATE_MASK = 0xF0,
      OF_STATE_SHL = 4;

  var s = ScummVM.engines.SCUMM;

  s.ResourceManager = function(engine) {
    var t = this;
    t.engine = engine;
    t.types = {};
    for(i in resourceTypes) {
      type = resourceTypes[i];
      t.types[type] = {mode: 1, num: 0, tags: 0, name:type, address:[], flags: 0, status: 0, roomno: [], roomoffs: []};
    }
  }

  s.ResourceManager.prototype = {
    validateResource: function(type, index) {
      for(i in resourceTypes) {
        t = resourceTypes[i];
        if(type == t && index < this.types[type].num) {
          return true;
        }
      }
      return false;
    },
    createResource: function(type, idx, size, source) {
      var t = this, stream,
          res = t.types[type],
          file = t.engine._file;

      if(source == -1) {
        buf = "";
        for(i = 0; i < size; i ++) {
          buf += String.fromCharCode(0);
        }
        stream = new ScummVM.WritableStream(buf, size);
      } else {
        if(source) file = source;

        stream = file.newStream(file.offset, size);
      }

      debug(5, "creating "+type+" resource "+idx+" in file "+stream.filename+" size "+size);
      res.address[idx] = stream;

      return stream;
    },
    allocResTypeData: function(id, tag, num, name, mode) {
      var t = this,
          res = t.types[id];
      res.mode = mode;
      res.num = num;
      res.tags = tag;
      res.name = name;
      res.status = 0;
      res.address = new Array(); res.roomno = new Array(); res.roomoffs = new Array();
      for(i = 0; i < num; i++) {
        res.roomno[i] = 0;
        res.roomoffs[i] = 0;
        res.address[i] = null;
      }
    }
  };

  s.ObjectData = function() {
    var t = this;
    t.OBIMoffset = 0;
    t.OBCDoffset = 0;
    t.walk_x = 0; t.walk_y = 0;
    t.obj_nr = 0;
    t.x_pos = 0; t.y_pos = 0;
    t.width = 0; t.height = 0;
    t.actordir = 0;
    t.parent = 0; t.parentstate = 0;
    t.state = 0;
    t.fl_object_index = 0;
    t.flags = 0;
  };

  s.indexFile = function() {
    return this._files[0];
  }

  s.generateFilename = function(room) {
    var res = this._res.types["room"];
    diskNumber = room > 0 ? res.roomno[room] : 0;
    return this._game + ".00"+diskNumber;
  }

  s.openResourceFile = function(filename) {
    debug(3, "opening "+filename);
    this._file = this._files[this._filenames[filename]];
    return true;
  }

  s.readIndexFile = function() {
    var t = this, blocktype, itemsize,
        numblock = 0,
        MKID_BE = _system.MKID_BE;
    var file = t._file;

    t.closeRoom();
    t.openRoom(0);
    while(true) {
      blocktype = file.readUI32(true);
      itemsize = file.readUI32(true);
      if(file.eof()) break;
      // log(_system.reverse_MKID(blocktype)+ " "+itemsize);

      switch(blocktype) {
      case MKID_BE("DOBJ"):
        this._nums['global_objects'] = file.readUI16();
        itemsize -= 2;
      break;
      case MKID_BE("DROO"):
        this._nums['rooms'] = file.readUI16();
        itemsize -= 2;
      break;
      case MKID_BE("DSCR"):
        this._nums['scripts'] = file.readUI16();
        itemsize -= 2;
      break;
      case MKID_BE("DCOS"):
        this._nums['costumes'] = file.readUI16();
        itemsize -= 2;
      break;
      case MKID_BE("DSOU"):
        this._nums['sounds'] = file.readUI16();
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
          name = _system.xorString(file.readString(9), 0xFF);
          debug(5, "Room "+room+": "+name);
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
        t.allocateArrays();
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

  s.readRoomsOffsets = function() {
    var t = this,
        file = t._files[1],
        res = t._res.types["room"];
    num = file.seek(16, true).readUI8();
    while(num--) {
      room = file.readUI8();
      if(!res.roomoffs[room]) {
        res.roomoffs[room] = file.readUI32();
      } else {
        file.readUI32();
      }
    }
    file.reset();
  };

  s.deleteRoomOffsets = function() {
    var t = this,
        res = t._res.types["room"];

    res.roomofs = [];
  };

  s.closeRoom = function() {
    var t = this,
        file = t._file;
    if(t._lastLoadedRoom != -1) {
      t._lastLoadedRoom = -1;
      t.deleteRoomOffsets();
      file.reset();
    }
  };

  s.openRoom = function(room) {
    var t = this,
        file = t._file,
        res = t._res.types["room"];
    if(t._lastLoadedRoom == room)
      return;
    t._lastLoadedRoom = room;
    debug(3, "loading room " + room);
    if(room == -1) {
      t.deleteRoomOffsets();
      file.reset();
      return;
    }
    diskNumber = room ? res.roomno[room] : 0;
    room_offs = room ? res.roomoffs[room] : 0;

    while(room_offs != RES_INVALID_OFFSET) {
      this.readRoomsOffsets();

      filename = t.generateFilename(room);
      if(t.openResourceFile(filename)) {
        file = t._file;
        if(room == 0)
          return;

        // t.deleteRoomOffsets();
        // t.readRoomsOffsets();

        t._fileOffset = res.roomoffs[room];

        if(t._fileOffset != 8)
          return;
      }
      log("ask for disk "+diskNumber);
    }
    t.deleteRoomOffsets();
    t._fileOffset = 0;
  };

  s.readResTypeList = function(file, type) {
    var t = this;
    var num, i;
    num = file.readUI16();

    var res = t._res.types[type];

    res.num = num;

    for(i = 0; i < num; i++) {
      res.roomno[i] = file.readUI8();
    }
    for(i = 0; i < num; i++) {
      res.roomoffs[i] = file.readUI32();
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
    t._nums['images'] = 0;
    t._nums['actors'] = 13;
  };

  s.allocateArrays = function() {
    var t = this, i,
        res = t._res,
        nums = t._nums,
        MKID_BE = _system.MKID_BE;

    for(i = 0; i < nums['variables']; i++) {
      t._scummVars[i] = 0;
    }
    for(i = 0; i < nums['local_objects']; i++) {
      t._objs[i] = new t.ObjectData();
    }
    for(i = 0; i < nums['bit_variables'] >> 3; i++) {
      t._bitVars[i] = 0;
    }
    res.allocResTypeData("costume", MKID_BE('COST'), nums['costumes'], "costume", 1);
    res.allocResTypeData("room", MKID_BE('ROOM'), nums['rooms'], "room", 1);
    res.allocResTypeData("room_image", MKID_BE('RMIM'), nums['rooms'], "room image", 1);
    res.allocResTypeData("script", MKID_BE('SCRP'), nums['scripts'], "script", 1);
    // charset
    res.allocResTypeData("object_name", 0, nums['new_names'], "new name", 0);
    // inventory
    // temp ?
    // scale_table
    res.allocResTypeData("actor_name", 0, nums['actors'], "actor name", 0);
    // verb
    res.allocResTypeData("string", 0, nums['array'], "array", 0);
    res.allocResTypeData("fl_object", 0, nums['fl_object'], "flobject", 0);
    // matrix
    res.allocResTypeData("image", MKID_BE('AWIZ'), nums['images'], "images", 1);

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

  s.loadCharset = function(no) {
    var t = this, i, ptr;
    ptr = t.getResourceAddress("charset", no);
    t._charsetData[no] = [];
    for(i = 0; i < 15; i++) {
      t._charsetData[no][i + 1] = ptr.seek(i + 14, true).readUI8();
      t._charsetColorMap[i] = t._charsetData[no][i + 1];
    }
  };

  s.getResourceRoomNr = function(type, idx) {
    var t = this,
        res = t._res.types[type];
    if(type == "room") return idx;
    return res.roomno[idx];
  }
  s.getResourceAddress = function(type, idx) {
    var t = this, offset,
        res = t._res,
        res_type = res.types[type];

    if(!res.validateResource(type, idx)) return null;
     if(res_type.mode)
       t.ensureResourceLoaded(type, idx);

    return res_type.address[idx];
  };

  s.ensureResourceLoaded = function(type, idx) {
    var t = this, addr
        res = t._res.types[type];

    if(type == "room" && idx > 0x0F) {
      // resourceMapper
    }
    if(type != "charset" && idx == 0) return;

    if(idx <= res.num)
      addr = res.address[idx];

    if(addr) return;

    t.loadResource(type, idx);
    // ROOM_FLAG
  };

  s.loadResource = function(type, idx) {
    var t = this, roomNr,
        res = t._res.types[type],
        fileOffs, size, tag;

    roomNr = t.getResourceRoomNr(type, idx);
    if(idx >= res.num) {
      error("resource undefined, index out of bounds");
    }
    if(roomNr == 0)
      roomNr = t._roomResource;

    window.console.log("loading resource "+type+" "+idx+" in room "+roomNr);

    if(type == "room") {
      fileOffs = 0;
    } else {
      fileOffs = res.roomoffs[idx];
      if(fileOffs == RES_INVALID_OFFSET)
        return 0;
    }

    t.openRoom(roomNr);

    var file = t._file;

    file.seek(t._fileOffset + fileOffs, true);

    tag = file.readUI32(true);
    size = file.readUI32(true);
    debug(5, _system.reverse_MKID(tag) + " "+size);
    file.seek(-8);

    t._res.createResource(type, idx, size);

    if(t._dumpScripts && type == "script")
      t.dumpResource("script-", idx, t.getResourceAddress("script", idx));
  };

  s.loadPtrToResource = function(type, resindex, source) {
    var t = this, len;
    len = t.resStrLen(source) + 1;
    if(len <= 0)
      return;

    if(!source) source = t._scriptPointer;
    ptr = t._res.createResource(type, resindex, len, source);
    source.seek(len);
  };

  s.dumpResource = function(tag, idx, stream) {
    var size = stream.length;
    log("dump "+tag+idx)
    log(stream.readString(size));
  };

  s.findResource = function(tag, source, debug) {
    var t = this, curpos, totalsize, size, searchin;

    searchin = source.newRelativeStream(4);
    t._resourceLastSearchSize = totalsize = searchin.readUI32(true);
    curpos = 8;

    if(debug) log("searching ENCD");
    while(curpos < totalsize) {
      t = searchin.readUI32(true)
      if(t == tag) {
        t._resourceLastSearchBuf = searchin;
        size = searchin.readUI32(true);
          if(debug) log("offset ENCD "+searchin.offset.toString(16));
        searchin.seek(-8);
        return searchin.newStream(searchin.offset, size);
      }
      size = searchin.readUI32(true);
      if(size <= 8)
        return null;

      searchin.seek(size - 8);
      curpos += size;
    }
    return null;
  };

  s.findResourceData = function(tag, source) {
    var t = this,
        res = t.findResource(tag, source);
    if(res) res.seek(t._resourceHeaderSize);
    return res;
  };

  s.getResourceDataSize = function(stream) {
    var t = this, size, old_offset = stream.offset;

    stream.seek(4, true);
    size = stream.readUI32(true) - t._resourceHeaderSize;
    stream.seek(old_offset, true);
    return size;
  };

}());

