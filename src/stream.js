(function(){
  ScummVM.Stream = function(data) {
    this.buffer = data;
    this.length = this.buffer.length;
    this.offset = 0;
    this.encByte = 0;
  };
  ScummVM.Stream.prototype = {
    readByteAt: function(pos){
        return this.buffer.charCodeAt(pos) & 0xff;
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
    seek: function(offset, absolute){
      this.offset = (absolute ? 0 : this.offset) + offset;
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
