(function(){
  var filesToLoad = 0;

  ScummVM.system = {
    new_dir_table: [ 270, 90, 180, 0 ],
    Point: function(x, y) {
      return {x: x, y: y};
    },
    clone: function(obj) {
      var clone = {};
      clone.prototype = obj.prototype;
      for (property in obj) clone[property] = obj[property];
      return clone;
    },
    getMillis: function() {
      d = new Date();
      return d.getTime();
    },
    loadGameFiles: function(game, file_nos, callback) {
      var callback = callback;
      var t = this, i;

      filesToLoad += file_nos.length;

      for(i = 0; i < file_nos.length; i++) {
        var i = i;
        (function() { // Fix var scope
        var file_no = file_nos[i];
        var filename = game + ".00"+file_no.toString();
        var game_url = "games/"+game+"/"+filename;

        if(navigator.vendor.match("Apple") && window.localStorage[game_url]) {
          log(game_url + " loaded from cache");
          ScummVM.engine.setFile(file_no, filename, localStorage[game_url]);
          filesToLoad--;
          if(t.finishedLoading() && callback)
            callback();
        } else {
          $.ajax({type: "GET", url: game_url, dataType: "text", cache:false, success: function(data) {
            log(game_url + " loaded");
            try {
              if(navigator.vendor.match("Apple")) window.localStorage[game_url] = data;
            } catch(e) {
            };
            ScummVM.engine.setFile(file_no, filename, data);
            filesToLoad--;
            if(t.finishedLoading() && callback)
              callback();
          }, beforeSend: function(xhr) { xhr.overrideMimeType("text/plain; charset=x-user-defined"); } });
        }
        })();
      }
    },
    finishedLoading: function() {
      return filesToLoad == 0;
    },
    xorString: function(str, encByte) {
      stream = new ScummVM.Stream(str, "", str.length);
      stream.encByte = encByte;
      return stream.readString(str.length);
    },
    MKID_BE: function(id) {
      s = new ScummVM.Stream(id, "", 4);
      return s.readUI32(true);
    },
    reverse_MKID: function(value) {
      var isNegative, orig_value, i, Rem, s = "";
      isNegative = (value < 0);
      if (isNegative) {
        value = value * (0 - 1);
      }
      orig_value = value;
      for (i = 0; i < 4; i++) {
        Rem = value % 256;
        if (isNegative) {
          Rem = 255 - Rem;
        }
        s = String.fromCharCode(Rem) + s;
        value = Math.floor(value / 256);
      }
      if (value > 0) {
        throw ("Argument out of range: " + orig_value);
      }
      return s;
    },
    newDirToOldDir: function(dir) {
      if(dir >= 71 && dir <= 109) return 1;
      if(dir >= 109 && dir <= 251) return 2;
      if(dir >= 251 && dir <= 289) return 0;
      return 3;
    },
    oldDirToNewDir: function(dir) {
      window.console.log("converting dir "+dir+" -> "+this.new_dir_table[dir]);
      return this.new_dir_table[dir];
    },
    toSimpleDir: function(dirType, dir) {
      var directions = [ 22, 72, 107, 157, 202, 252, 287, 337];
      for(var i = 0; i < 7; i++) {
        if(dir >= directions[i] && dir <= directions[i+1]);
            return i+1;
      }
      return 0;
    },
    normalizeAngle: function(angle) {
      var temp = (angle + 360) % 360;
      return this.toSimpleDir(1, temp) * 45;
    }
  };
}());
