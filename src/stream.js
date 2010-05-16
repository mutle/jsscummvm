(function(){
  ScummVM.Stream = function(data) {
    this.buffer = data;
    this.length = this.buffer.length;
    this.offset = 0;
    this.encByte = 0;
  };
  ScummVM.Stream.prototype = {
    readByteAt: function(pos){
      return this.buffer.charCodeAt(pos) & 0xff ^ this.encByte;
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
          b = t.buffer;
      if(undefined != numChars){
          var str = b.substr(t.offset, numChars);
          t.offset += numChars;
      }else{
          numChars = t.length - t.offset;
          var chars = [],
              i = numChars;
          while(i--){
              var code = t.readByteAt(t.offset++);
              if(code){ chars.push(String.fromCharCode(code)); }
              else{ break; }
          }
          var str = chars.join('');
      }
      return str;
    },
    seek: function(offset, absolute){
      this.offset = (absolute ? 0 : this.offset) + offset;
      if(this.offset > this.length) alert("jumped too far");
      return this;
    },
    eof: function() {
      return this.offset >= this.length;
    },
    reset: function() {
      this.seek(0, true);
    }

  };

}());
