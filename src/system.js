(function(){
  ScummVM.system = {
    getMillis: function() {
      d = new Date();
      return d.getTime();
    },
    loadGameFile: function(game, file_no, callback) {
      var callback = callback;
      var filename = game + ".00"+file_no.toString();
      game_url = "/games/"+game+"/"+filename;
      $.ajax({type: "GET", url: game_url, dataType: "text", cache:false, success: function(data) {
          ScummVM.engine.setFile(filename, data);
          if(callback) callback();
      }, beforeSend: function(xhr) { xhr.overrideMimeType("text/plain; charset=x-user-defined"); } });
    },
    xorString: function(str, encByte) {
      stream = new ScummVM.Stream(str);
      stream.encByte = encByte;
      return stream.readString(str.length);
    },
    MKID_BE: function(id) {
      s = new ScummVM.Stream(id);
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
