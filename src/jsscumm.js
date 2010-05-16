var ScummVM = {
  width: 320,
  height: 200,
  engines: {},
  engine: null
};

(function(){
  var canvas = document.getElementById("jsscummvm");
  var context = canvas.getContext('2d');
  ScummVM.load = function(game) {
    var t = ScummVM;
    t.init_graphics();
    t.engine = ScummVM.engines.SCUMM;
    t.engine.init(game);
    t.engine.go();
  };
  ScummVM.init_graphics = function() {
    context.fillRect(0,0,this.width,this.height);
  };
}());
