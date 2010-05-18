(function(){
  var filesToLoad = 0;

  ScummVM.system = {
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
            window.localStorage[game_url] = data;
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
    }
  };
}());
