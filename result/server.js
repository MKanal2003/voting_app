var express = require('express'),
    async = require('async'),
    { Pool } = require('pg'),
    cookieParser = require('cookie-parser'),
    app = express(),
    server = require('http').Server(app),
    io = require('socket.io')(server);

var port = process.env.PORT || 4000;

// When a browser connects via Socket.io
io.on('connection', function (socket) {
  // Send a welcome message so the browser knows it's connected
  socket.emit('message', { text: 'Welcome!' });

  socket.on('subscribe', function (data) {
    socket.join(data.channel);
  });
});

// Connect to Postgres
var pool = new Pool({
  connectionString: 'postgres://postgres:postgres@db/postgres'
});

// Retry connecting up to 1000 times (every 1 second)
// Postgres might not be ready immediately when this app starts
async.retry(
  { times: 1000, interval: 1000 },
  function(callback) {
    pool.connect(function(err, client, done) {
      if (err) {
        console.error("Waiting for db");
      }
      callback(err, client);
    });
  },
  function(err, client) {
    if (err) {
      return console.error("Giving up");
    }
    console.log("Connected to db");
    getVotes(client);
  }
);

// Query Postgres every 1 second and broadcast results
function getVotes(client) {
  client.query(
    'SELECT vote, COUNT(id) AS count FROM votes GROUP BY vote',
    [],
    function(err, result) {
      if (err) {
        console.error("Error performing query: " + err);
      } else {
        var votes = collectVotesFromResult(result);
        // Emit scores to ALL connected browsers at once
        io.sockets.emit("scores", JSON.stringify(votes));
      }

      // Call itself again after 1 second — creates a polling loop
      setTimeout(function() { getVotes(client) }, 1000);
    }
  );
}

// Turn the SQL result into { a: 42, b: 17 }
function collectVotesFromResult(result) {
  var votes = { a: 0, b: 0 };

  result.rows.forEach(function(row) {
    votes[row.vote] = parseInt(row.count);
  });

  return votes;
}

// Serve static files from the views/ folder
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/views'));

// Main route — send the HTML page
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

server.listen(port, function() {
  console.log('App running on port ' + port);
});