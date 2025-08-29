const express = require('express')
const http = require('http')
var cors = require('cors')
const app = express()
const bodyParser = require('body-parser')
const path = require("path")
var xss = require("xss")

var server = http.createServer(app)
var io = require('socket.io')(server)

app.use(cors())
app.use(bodyParser.json())

if (process.env.NODE_ENV === 'production') {
	app.use(express.static(__dirname + "/build"))
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname + "/build/index.html"))
	})
}

app.set('port', (process.env.PORT || 4001))

sanitizeString = (str) => {
	return xss(str)
}

connections = {}
messages = {}
timeOnline = {}

io.on('connection', (socket) => {

	socket.on('username', (username) => {
		// Find which room the user is in
		let key;
		for (const [k, v] of Object.entries(connections)) {
			if (v.includes(socket.id)) {
				key = k;
				break;
			}
		}

		// Broadcast the username to everyone else in that same room
		if (key) {
			console.log(`[SERVER] Broadcasting username '${username}' from ${socket.id} to room ${key}`);
			// socket.broadcast.to(key) sends to everyone in the room except the sender
			socket.broadcast.to(key).emit('username', username, socket.id);
		}
	});

	socket.on('username-broadcast', (username) => {
	    // Use the room remembered from join-call
	    const room = socket.currentRoom;
	    if (room) {
	        console.log(`[SERVER] Relaying username '${username}' from ${socket.id} to everyone in room ${room}`);
	        io.to(room).emit('username-received', username, socket.id);
	    }
	});

socket.on('meeting-started', (room, meetingId) => {
    // Broadcast to everyone else in the room that the meeting has an ID now
    console.log(`[SERVER] Teacher ${socket.id} broadcasting meeting ID ${meetingId} to room ${room}`);
    console.log(`[SERVER] Teacher's rooms:`, Array.from(socket.rooms));
    console.log(`[SERVER] Users in connections[${room}]:`, connections[room] || []);
    socket.broadcast.to(room).emit('meeting-id-received', meetingId);
    console.log(`[SERVER] Meeting ID broadcast sent to room ${room}`);
});

socket.on('request-meeting-id', () => {
    // Broadcast the request to everyone in the room
    const room = Array.from(socket.rooms)[1];
    console.log(`[SERVER] Student ${socket.id} requesting meeting ID in room ${room}`);
    if (room) {
        socket.broadcast.to(room).emit('request-meeting-id');
        console.log(`[SERVER] Request for meeting ID broadcast to room ${room}`);
    }
});

	socket.on('join-call', (path) => {
		// Join the socket.io room
		socket.join(path);
		// Remember the room for later broadcasts
		socket.currentRoom = path;
		console.log(`[SERVER] User ${socket.id} joined room ${path}`);
		
		if (connections[path] === undefined) {
			connections[path] = []
		}
		connections[path].push(socket.id)

		timeOnline[socket.id] = new Date()

		for (let a = 0; a < connections[path].length; ++a) {
			io.to(connections[path][a]).emit("user-joined", socket.id, connections[path])
		}

		// If there are existing users in the room, ask them to re-broadcast their meeting ID
		if (connections[path].length > 1) {
			io.to(path).emit("request-meeting-id");
		}

		if (messages[path] !== undefined) {
			for (let a = 0; a < messages[path].length; ++a) {
				io.to(socket.id).emit("chat-message", messages[path][a]['data'],
					messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
			}
		}

		console.log(`[SERVER] Room ${path} now has users:`, connections[path])
	})

	socket.on('signal', (toId, message) => {
		io.to(toId).emit('signal', socket.id, message)
	})

	socket.on('chat-message', (data, sender) => {
		data = sanitizeString(data)
		sender = sanitizeString(sender)

		var key
		var ok = false
		for (const [k, v] of Object.entries(connections)) {
			for (let a = 0; a < v.length; ++a) {
				if (v[a] === socket.id) {
					key = k
					ok = true
				}
			}
		}

		if (ok === true) {
			if (messages[key] === undefined) {
				messages[key] = []
			}
			messages[key].push({ "sender": sender, "data": data, "socket-id-sender": socket.id })
			console.log("message", key, ":", sender, data)

			for (let a = 0; a < connections[key].length; ++a) {
				io.to(connections[key][a]).emit("chat-message", data, sender, socket.id)
			}
		}
	})

	socket.on('disconnect', () => {
		var diffTime = Math.abs(timeOnline[socket.id] - new Date())
		var key
		for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
			for (let a = 0; a < v.length; ++a) {
				if (v[a] === socket.id) {
					key = k

					for (let a = 0; a < connections[key].length; ++a) {
						io.to(connections[key][a]).emit("user-left", socket.id)
					}

					var index = connections[key].indexOf(socket.id)
					connections[key].splice(index, 1)

					console.log(key, socket.id, Math.ceil(diffTime / 1000))

					if (connections[key].length === 0) {
						delete connections[key]
					}
				}
			}
		}
	})
})

// server.listen(app.get('port'), () => {
// 	console.log("listening on", app.get('port'))
// })

server.listen(app.get('port'), '0.0.0.0', () => {
  console.log("listening on", app.get('port'));
});
