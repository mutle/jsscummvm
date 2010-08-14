(function(){
  ScummVM.Stream = function(data, filename, size) {
    this.filename = filename;
    this.buffer = data;
    if(filename == "")
      this.length = size || 0;
    else
      this.length = this.buffer.length;
    this.offset = 0;
    this.encByte = 0;
  };
  ScummVM.WritableStream = function(data, size) {
    this.filename = "";
    if(typeof data == "string")
      this.buffer = data.split("");
    else
      this.buffer = data;

    if(filename == "")
      this.length = size || 0;
    else
      this.length = this.buffer.length;
    this.offset = 0;
    this.encByte = 0;
  };
  ScummVM.Stream.prototype = {
    newStream: function(offset, size) {
      stream = new ScummVM.Stream(this.buffer.substring(offset, offset+size), this.filename);
      stream.encByte = this.encByte;
      debug(7, "New Stream "+this.filename+" at offset "+offset+" total size "+this.length+" stream size "+stream.length);
      return stream;
    },
    newAbsoluteStream: function(offset) {
      stream = new ScummVM.Stream(this.buffer, this.filename, this.length);
      stream.offset = offset;
      stream.encByte = this.encByte;
      debug(7, "New absolute Stream "+this.filename+" at offset "+stream.offset+" total size "+stream.length);
      return stream;
    },
    newRelativeStream: function(offset) {
      stream = new ScummVM.Stream(this.buffer, this.filename, this.length);
      stream.offset = this.offset;
      stream.encByte = this.encByte;
      if(offset)
        stream.seek(offset);
      debug(7, "New relative Stream "+this.filename+" at offset "+stream.offset+" total size "+stream.length);
      return stream;
    },
    readByteAt: function(pos){
      return (this.buffer.charCodeAt(pos) & 0xff) ^ this.encByte;
    },
    readNumber: function(numBytes, bigEnd){
        var t = this,
            val = 0;
        if(bigEnd){
            var i = numBytes;
            while(i--){ val = (val << 8) + t.readByteAt(t.offset++); }
        }else{
            var o = t.offset,
                i = o + numBytes;
            while(i > o){ val = (val << 8) + t.readByteAt(--i); }
            t.offset += numBytes;
        }
        return val;
    },
    readSNumber: function(numBytes, bigEnd){
        var val = this.readNumber(numBytes, bigEnd),
            numBits = numBytes * 8;
        if(val >> (numBits - 1)){ val -= Math.pow(2, numBits); }
        return val;
    },
    readSI8: function(){
        return this.readSNumber(1);
    },
    readSI16: function(bigEnd){
        return this.readSNumber(2, bigEnd);
    },
    readSI32: function(bigEnd){
        return this.readSNumber(4, bigEnd);
    },
    readUI8: function(){
        return this.readNumber(1);
    },
    readUI16: function(bigEnd){
        return this.readNumber(2, bigEnd);
    },
    readUI24: function(bigEnd){
        return this.readNumber(3, bigEnd);
    },
    readUI32: function(bigEnd){
        return this.readNumber(4, bigEnd);
    },
    readString: function(numChars){
      var t = this,
          b = t.buffer, str,
          chars = [];
      if(undefined != numChars){
        if(t.encByte == 0x00) {
          str = b.substr(t.offset, numChars);
          t.offset += numChars;
          return str;
        }
      }else{
        numChars = t.length - t.offset;
      }
      var i = numChars;
      while(i--){
          var code = t.readByteAt(t.offset++);
          if(code){ chars.push(String.fromCharCode(code)); }
          else{ break; }
      }
      str = chars.join('');
      return str;
    },
    seek: function(offset, absolute, ignoreWarnings){
      this.offset = (absolute ? 0 : this.offset) + offset;
      if(this.offset > this.length && !ignoreWarnings)
        window.console.log("jumped too far");
      return this;
    },
    eof: function() {
      return this.offset >= this.length;
    },
    reset: function() {
      this.seek(0, true);
      return this;
    },
    findNext: function(tag) {
      var t = this, oldoff = t.offset, rtag;
      while((rtag = t.readUI32(true)) != tag) {
        if(t.offset >= t.length) {
          t.seek(oldoff, true); return false;
        }
        size = t.readUI32(true);
        if(size == 0) {
          t.seek(oldoff, true); return false;
        }
        t.offset += size - 8;
      }
      t.seek(4);
      return true;
    },

  };
  ScummVM.WritableStream.prototype = {
    newRelativeStream: function(offset) {
      stream = new ScummVM.WritableStream(this.buffer, this.length);
      stream.offset = this.offset;
      stream.encByte = this.encByte;
      if(offset)
        stream.seek(offset);
      debug(7, "New relative Stream "+this.filename+" at offset "+stream.offset+" total size "+stream.length);
      return stream;
    },
    writeByteAt: function(pos, value) {
      this.buffer[pos] = String.fromCharCode(value & 0xFF);
    },
    writeUI8: function(value) {
      this.writeByteAt(this.offset, value);
      this.offset++;
    },
    readUI8: function() {
      val = this.buffer[this.offset++];
      return val ? val.charCodeAt(0) : 0;
    },
    toStr: function() {
      return this.buffer.join("");
    },
    seek: function(offset, absolute, ignoreWarnings){
      this.offset = (absolute ? 0 : this.offset) + offset;
      if(this.offset > this.length && !ignoreWarnings)
        window.console.log("jumped too far");
      return this;
    },
    reset: function() {
      this.seek(0, true);
      return this;
    }
  };

}());
