
# PeerCS-Core

Client-Server Architecture over P2P

![version](https://img.shields.io/badge/version-0.1.0-blue)

[![English](https://img.shields.io/badge/English-Current-brightgreen)](README.md) [![简体中文](https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-Click%20to%20View-lightgrey)](README_zh-CN.md)

**PeerCS-Core** is a lightweight WebRTC communication JavaScript library built on [PeerJS](https://peerjs.com/).
It abstracts a classic **Client/Server (C/S)** architecture on top of P2P.
It allows browser instances to act as a **Server/Host** or a **Client** without deploying any backend (beyond PeerJS's signaling server).

## 🌟 Key Features

- **Virtual C/S Architecture**: Any client can become a host acting as the server. Any client can connect to the host when network conditions and the host allow.
- **Lightweight**: No Node.js or any backend runtime required; minimal external dependencies.
- **Event-Driven**: Socket.io-like API design.
- **Auto Connection Management**: Built-in heartbeat, auto-reconnect, and serialization handling. (Planned)

---

## 🛠 Architecture

PeerCS-Core builds a star-topology overlay network on top of WebRTC. It has two roles: **Server** as the central hub and **Client** as leaf nodes in the star topology.

---

## 🚀 Quick Start

### 1. Installation

Via CDN (browser):
```HTML
<script src="https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js"></script>
<script src="./dist/peercs.global.js"></script>
```

Via NPM (bundler):
```bash
npm install @peercs/peercs-core
```

### 2. Server

The Server listens for client connections and handles business logic.
```Javascript
const server = new PeerCS.Server('my-server', 'my-server-id');

server.on('p:connection', (conn) => {
  console.log('Client Connected:', conn.id, conn.name);
});

server.on('s:chat', (conn, payload) => {
  console.log(`Received Message From ${conn.id} [${conn.name}]:`, payload.text);
});

server.start();
```

### 3. Client

The Client connects to the Server using its Server ID.
```Javascript
const client = new PeerCS.Client('my-server-id', 'my-client');

client.on('s:chat', (conn, payload, sender) => {
  console.log(`${sender?.name || 'Server'}: ${payload.text}`);
});

client.connect();

// Send a message visible only to the Server
client.send('s:chat', 'Hello!');

// Send a message to be broadcast to all Clients (Server injects sender info)
client.send('s:chat', { text: 'Hello everyone!' }, { broadcast: true });
```

---

## 💻 Running the Example

1. **Build**:
   ```bash
   npm install
   npm run build
   ```
2. Open `examples/quick-start/index.html` in a browser.

---

## 📖 API Reference

### Legend

| Symbol | Meaning |
| --- | --- |
| ⏳ | Planned / In progress |
| ✅ | Completed |

### PeerCS.Data (Packet)

| Field | Type | Description |
| --- | --- | --- |
| `event` | String | Event name. Conventions: `p:*` (peer-level events like `p:connection`), `s:*` (system events like `s:chat`), `u:*` (user-defined events) |
| `payload` | Unknown | Data payload |
| `timestamp` | Number | Unix timestamp |
| `broadcast` | Boolean (optional) | Client requests the Server to relay this message to all Clients (including the sender) |
| `sender` | Object (optional) | Source info `{ id: string, name: string, isHost?: boolean }` (PeerCSMember). Defaults to the Server when absent |

### PeerCS.Event

Peer-level events:

| Name | Description | Scope | Status |
| --- | --- | --- | --- |
| `p:connected` | Local peer initialized (Ready) | Server & Client | ✅ |
| `p:connection_attempt` | Incoming connection request | Server | ✅ |
| `p:connection` | Connection established (Open) | Server & Client | ✅ |
| `p:disconnected` | Connection closed | Server & Client | ✅ |
| `p:error` | Error occurred | Server & Client | ✅ |

System events:

| Name | Description | Scope | Status |
| --- | --- | --- | --- |
| `s:connection_list` | Member list sync | Server & Client | ✅ |
| `s:chat` | Built-in chat (example convention) | Server & Client | ✅ |

User-defined events can use any name (preferably `u:*`).

### PeerCS.Server

| Method | Description | Status |
| --- | --- | --- |
| `constructor(name, id?, options?): PeerCS.Server` | Initialize Server. Options: `debugLog`, `broadcastAllowlist`, `broadcastValidator`, plus any PeerJS options | ✅ |
| `start(): Promise<void>` | Start the server and begin accepting connections | ✅ |
| `shutdown(): void` | Stop the server and disconnect all clients | ✅ |
| `getConnectionIds(): string[]` | Get IDs of all connected clients | ✅ |
| `getConnections(): Set<PeerCS.Connection>` | Get all client connections | ✅ |
| `getConnection(clientId): Connection` | Get a specific client connection | ✅ |
| `kick(clientId): void` | Forcefully disconnect a client | ✅ |
| `broadcast(event, payload, sender?): void` | Send a message to all connected clients. `sender` defaults to the Server when absent | ✅ |
| `send(event, clientId, payload): void` | Send a message to a specific client | ✅ |
| `on(event, callback)` | Listen for events | ✅ |
| `off(event, callback?)` | Unlisten for events | ✅ |

**Auto-broadcast**: When a Client sends a message with `{ broadcast: true }`, the Server automatically calls `broadcast(event, payload, sender)` to relay it to **all connected Clients (including the sender)**, where `sender` contains the source client's `PeerCSMember` info.

**Broadcast control**: The Server can control which client-initiated broadcasts are allowed via `options`. When no `broadcastAllowlist` is configured, **all broadcasts are denied by default**.

- **`broadcastAllowlist: string[]`** — Event allowlist. Only listed events are relayed.
- **`broadcastValidator: (event, payload, conn) => boolean`** — Custom validation function. Receives event name, payload, and source connection; returns `true` to allow broadcast.

When both are set, **both must pass** for the broadcast to proceed.

```javascript
const server = new PeerCS.Server('my-server', 'my-server-id', {
    broadcastAllowlist: ['u:chat', 'u:move'],
    broadcastValidator: (event, payload, conn) => event.startsWith('u:'),
});
```

### PeerCS.Client

| Method | Description | Status |
| --- | --- | --- |
| `constructor(serverId, name, id?, options?): PeerCS.Client` | Initialize Client. Options: `debugLog`, plus any PeerJS options | ✅ |
| `connect(): Promise<void>` | Connect to the server | ✅ |
| `disconnect(): void` | Disconnect from the server | ✅ |
| `send(event, payload): void` | Send a message to the Server only | ✅ |
| `send(event, payload, { broadcast: true })` | Send a message and request the Server to broadcast to all Clients | ✅ |
| `on(event, callback)` | Listen for events | ✅ |
| `off(event, callback?)` | Unlisten for events | ✅ |

---

## 🔄 Data Sync Patterns

PeerCS-Core recommends a unified data sync model under the Client-Server architecture:

```
Client A ──send(event, payload, { broadcast: true })──▶ Server
                                                          │
                                     broadcast(event, payload, sender)
                                                          │
                              ┌───────────────────────────┼───────────────────────────┐
                              ▼                           ▼                           ▼
                          Client A                   Client B                   Client C
                       (receives own msg,        (receives sync data,       (receives sync data,
                        sender = A)               sender = A)                sender = A)
```

- **Client communicates only with the Server**, not directly with other Clients
- Messages requiring sync use `{ broadcast: true }`; the Server automatically relays to all Clients (with `sender` info)
- **All Clients (including the sender) process data only after receiving the broadcast** (Pattern A)
- The sender can identify its own messages via `sender.id === localPeerId`

---

## Risks & Limitations

- **Security**: This project operates on a trust-based model. Anyone with the Server ID can connect. Use `broadcastAllowlist` and `broadcastValidator` to mitigate malicious messages.
- **PeerJS limitations**: Shared Peer IDs may conflict; depends on a signaling server.
- **WebRTC limitations**: Network/firewall restrictions may prevent connections. A single browser-based hub node can typically support only dozens of concurrent connections.

---

## 📜 License

MIT License.
