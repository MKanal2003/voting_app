var socket = io.connect();

var aPercent = document.getElementById('a-percent');
var bPercent = document.getElementById('b-percent');
var barA = document.getElementById('bar-a');
var barB = document.getElementById('bar-b');
var totalEl = document.getElementById('total');

socket.on('scores', function(json) {
  var data = JSON.parse(json);
  var a = parseInt(data.a || 0);
  var b = parseInt(data.b || 0);
  var total = a + b;

  var pA = total > 0 ? Math.round(a / total * 100) : 50;
  var pB = total > 0 ? (100 - pA) : 50;

  aPercent.textContent = pA + '%';
  bPercent.textContent = pB + '%';
  barA.style.width = pA + '%';
  barB.style.width = pB + '%';
  totalEl.textContent = total;
});