var ScummVM = {
  width: 320,
  height: 200,
  scale: 1,
  engines: {},
  engine: null,
  canvas: null,
  context: null,
  debugLevel: 3
};

function log(message) {
  // window.console.log(message);
  $("#console").prepend(message+"<br />");
}

function debug(level, message) {
  if(level <= ScummVM.debugLevel)
    log(message);
}

function error(message) {
  log("ERROR "+message);
}

function assert(condition) {
  if(!condition) {
    log("ASSERTION FAILED!");
  }
}

(function(){
  var canvas = document.getElementById("jsscummvm");
  var context = canvas.getContext('2d');
  ScummVM.load = function(game) {
    var t = ScummVM;
    t.canvas = canvas;
    t.context = context
    t.init_graphics();
    t.engine = ScummVM.engines.SCUMM;
    t.engine.init(game);
    t.engine.go();
  };
  ScummVM.init_graphics = function() {
    var t = this;
    t.context.fillRect(0,0,this.width,this.height);
  };

  window.document.addEventListener("keypress", function(e) {
    var c = String.fromCharCode(e.keyCode)
    ScummVM.engine._lastKeyHit = "ESC";
    return true;
  });

}());
