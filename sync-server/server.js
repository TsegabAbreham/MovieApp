// server.js
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`WebSocket server running on ws://localhost:${PORT}`);

/**
 rooms = {
   roomCode: {
     hostId: "<clientId>|null",
     clients: {
       "<clientId>": { ws: WebSocket, username: "Bob" },
       ...
     }
   }
 }
*/
const rooms = {};

function safeParse(msg) {
  try { return JSON.parse(msg); } catch (e) { return null; }
}

function broadcastToRoom(room, obj, exceptClientId = null) {
  if (!rooms[room]) return;
  const payload = JSON.stringify(obj);
  Object.entries(rooms[room].clients).forEach(([cid, info]) => {
    if (cid === exceptClientId) return;
    try {
      if (info.ws.readyState === WebSocket.OPEN) info.ws.send(payload);
    } catch (e) { /* ignore */ }
  });
}

function sendPresence(room) {
  if (!rooms[room]) return;
  const participants = Object.entries(rooms[room].clients).map(([clientId, info]) => ({
    clientId,
    username: info.username || "Anon"
  }));
  const hostId = rooms[room].hostId || null;
  const msg = { type: "presence", participants, hostId };
  // broadcast to all in room
  Object.values(rooms[room].clients).forEach(info => {
    try {
      if (info.ws.readyState === WebSocket.OPEN) info.ws.send(JSON.stringify(msg));
    } catch (e) {}
  });
}

wss.on("connection", (ws) => {
  // attach meta so we can cleanup on close
  ws._room = null;
  ws._clientId = null;

  ws.on("message", (raw) => {
    const data = safeParse(raw);
    if (!data || !data.type) return;

    // join message: { type: "join", room, clientId, username }
    if (data.type === "join" && data.room && data.clientId) {
      const room = String(data.room);
      const clientId = String(data.clientId);
      const username = String(data.username || ("User-" + clientId.slice(0,4)));

      ws._room = room;
      ws._clientId = clientId;

      if (!rooms[room]) rooms[room] = { hostId: null, clients: {} };

      // add client
      rooms[room].clients[clientId] = { ws, username };

      // assign host if none
      if (!rooms[room].hostId) rooms[room].hostId = clientId;

      // reply to this client: host flag
      try {
        ws.send(JSON.stringify({ type: "host", isHost: rooms[room].hostId === clientId }));
      } catch (e) {}

      // broadcast user-joined to others
      broadcastToRoom(room, { type: "user-joined", clientId, username }, clientId);

      // then broadcast full presence to everyone
      sendPresence(room);

      console.log(`JOIN room=${room} client=${clientId} username=${username} host=${rooms[room].hostId}`);
      return;
    }

    // presence:get -> reply with current presence for that room
    if (data.type === "presence:get" && data.room) {
      const room = String(data.room);
      if (rooms[room]) {
        const participants = Object.entries(rooms[room].clients).map(([clientId, info]) => ({
          clientId,
          username: info.username || "Anon"
        }));
        const hostId = rooms[room].hostId || null;
        try { ws.send(JSON.stringify({ type: "presence", participants, hostId })); } catch (e) {}
      } else {
        try { ws.send(JSON.stringify({ type: "presence", participants: [], hostId: null })); } catch (e) {}
      }
      return;
    }

    // room must exist for other operations
    const room = ws._room;
    const clientId = ws._clientId;

    if (!room || !rooms[room]) return;

    // handle start/reload/play/pause/seek -> broadcast to others
    if (["start", "reload", "play", "pause", "seek"].includes(data.type)) {
      // attach sender identity to forwarded message optionally
      const forward = Object.assign({}, data, { clientId });
      broadcastToRoom(room, forward, clientId);
      console.log(`BROADCAST ${data.type} from ${clientId} to room ${room}`);
      return;
    }

    // other messages can be forwarded or logged
    console.log("Unhandled WS message:", data);
  });

  ws.on("close", () => {
    const room = ws._room;
    const clientId = ws._clientId;
    if (!room || !rooms[room]) return;

    // remove client
    delete rooms[room].clients[clientId];
    // broadcast user-left
    broadcastToRoom(room, { type: "user-left", clientId }, clientId);
    console.log(`LEFT room=${room} client=${clientId}`);

    // if host left, pick new host (first key) and inform everyone
    if (rooms[room].hostId === clientId) {
      const remaining = Object.keys(rooms[room].clients);
      rooms[room].hostId = remaining[0] || null;
      console.log(`NEW HOST for ${room}: ${rooms[room].hostId}`);
      // send host messages to all clients
      if (rooms[room].hostId) {
        broadcastToRoom(room, { type: "host", isHost: false }); // others false
        const hostSock = rooms[room].clients[rooms[room].hostId].ws;
        try { hostSock.send(JSON.stringify({ type: "host", isHost: true })); } catch (e) {}
      } else {
        // room empty: remove it
        delete rooms[room];
        return;
      }
    }

    // send updated presence
    sendPresence(room);
  });

  ws.on("error", (err) => {
    console.error("ws error", err);
  });
});
