
# PeerCS-Core

Client-Server Architecture over P2P

![version](https://img.shields.io/badge/version-0.1.0-blue)

[![English](https://img.shields.io/badge/English-Click%20to%20View-lightgrey)](README.md) [![简体中文](https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-Current-brightgreen)](README_zh-CN.md)

**PeerCS-Core** 是一个轻量级 WebRTC 通讯 JavaScript 库，基于 [PeerJS](https://peerjs.com/) 实现。
它在 P2P 的底层基础上抽象出了经典的 **Client/Server (C/S)** 架构。
它允许开发者在无需部署后端服务（除 PeerJS 的信令服务）的情况下，让浏览器中的实例成为“主机（Server/Host）”，或称为“客户端（Client）”进行接入。

## 🌟 核心特性

- **虚拟 C/S 架构**：任意客户端均可成为主机，充当服务端。任意客户端可以在网络支持和主机允许的情况下连接到主机。
- **轻量级**：无需 Node.js 等任何后端运行时，外部依赖少。
- **事件驱动**：类 Socket.io 的 API 设计。
- **自动连接管理**：内置心跳检测、自动重连及序列化处理。（待实现）

---

## 🛠 核心架构设计

PeerCS-Core 的工作原理是在 WebRTC 之上建立了一层星型结构的逻辑拓扑，本质上是构建一个覆盖网络（Overlay Network）。
PeerCS-Core 包含 Server 和 Client 这2中角色。Server 作为中央节点，Client 为星型拓扑的末端节点。

---

## 🚀 快速开始

### 1. 安装 / 引入

在 HTML 中直接引入。
```HTML
<script src="https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js"></script>
<script src="./dist/index.global.js"></script>
```

### 2. 实现服务端 (Server)

服务端负责监听客户端连接并处理业务逻辑。
```Javascript
const server = new PeerCS.Server('first-server-123', 'my-server-id-123');

server.on('p:connection', (conn) => {
  console.log('Client Connected:', conn.id, conn.name);
});

server.on('s:chat', (conn, payload) => {
  console.log(`Recieved Message From ${conn.id} [${conn.name}]:`, payload.text);
});

server.start();
```

### 3. 实现客户端 (Client)

客户端通过 Server 的 Server ID 进行连接。
```Javascript
const client = new PeerCS.Client('my-server-id-123', 'first-client-123');

client.on('s:chat', (conn, payload, sender) => {
  console.log(`${sender?.name || 'Server'}: ${payload.text}`);
});

client.connect();

// 发送仅 Server 可见的消息
client.send('s:chat', 'Hola!');

// 发送需要广播给所有 Client 的消息（Server 会自动注入 sender 信息）
client.send('s:chat', { text: 'Hello everyone!' }, { broadcast: true });
```

---

## 💻 运行示例

项目包含一个快速开始示例，可以让你在浏览器中直接体验 PeerCS-Core 的功能。

### 1. 构建项目
确保已安装依赖并生成库文件：
```bash
npm install
npm run build
```

### 2. 打开示例
使用浏览器直接打开 `examples/quick-start/index.html`。

### 3. 操作步骤
1. 在第一个标签页中，输入昵称（如 "Server"），点击 **As Server**。
2. 复制生成的 **Server ID**。
3. 在第二个标签页（或另一台电脑的浏览器）中，输入昵称（如 "Client"），点击 **As Client**。
4. 将复制的 **Server ID** 粘贴到输入框中，点击 **Connect**。
5. 现在你可以在客户端发送消息，并在服务端控制台及其它客户端实时查收。

---

## 📖 API 文档

### Legend/图例说明

| 图例 | 说明 |
| --- | --- |
| ⏳ | 待开始/开发中 |
| ✅ | 已完成 |

### PeerCS.Data/数据包

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `event` | String | 事件类型，强制约束：`p:*` 为底层事件，如 `p:connection` ；`s:*` 为系统事件，如 `s:chat` ；`u:*` 为用户事件 |
| `payload` | Unknown | 数据，包括静态数据和流式数据 |
| `timestamp` | Number | 时间戳 |
| `broadcast` | Boolean (optional) | Client 请求 Server 将此消息广播给所有 Client（含发送者自身） |
| `sender` | Object (optional) | 数据来源信息 `{ id: string, name: string, isHost?: boolean }` (PeerCSMember)，未指定时默认为 Server 自身 |

### PeerCS.Event/事件

底层事件(peer)：

| 名称 | 说明 | 所属 | 状态 |
| --- | --- | --- | --- |
| `p:connected` | 本地 Peer 初始化完成 (Ready) | 服务端 & 客户端 | ✅ |
| `p:connection_attempt` | 收到连接请求 (Incoming) | 服务端 | ✅ |
| `p:connection` | 连接建立完成 (Open) | 服务端 & 客户端 | ✅ |
| `p:disconnected` | 连接断开 | 服务端 & 客户端 | ✅ |
| `p:error` | 连接错误 | 服务端 & 客户端 | ✅ |

系统事件(system)：

| 名称 | 说明 | 所属 | 状态 |
| --- | --- | --- | --- |
| `s:connection_list` | 成员列表同步 | 服务端 & 客户端 | ✅ |
| `s:chat` | 内置消息 (示例约定) | 服务端 & 客户端 | ✅ |

用户事件可自行定义。

### PeerCS.Server/服务端

| 方法 | 说明 | 状态 |
| --- | --- | --- |
| `constructor(name, id?, options?): PeerCS.Server` | 初始化服务端。options 支持 `debugLog: true` 开启调试日志；`broadcastAllowlist: string[]` 设置允许广播的事件白名单；`broadcastValidator: (event, payload, conn) => boolean` 自定义广播校验函数 | ✅ |
| `start(): Promise<void>` | 服务端启动，开始接收连接 （初始化Peer），异步等待就绪 | ✅ |
| `shutdown(): void` | 服务端停止，断开所有连接 | ✅ |
| `getConnectionIds(): string[]` | 获取所有客户端连接 ID | ✅ |
| `getConnections(): Set<PeerCS.Connection>` | 获取所有客户端连接 | ✅ |
| `getConnection(clientId): Connection` | 获取特定的客户端连接 | ✅ |
| `kick(clientId): void` | 主动断开指定客户端连接 | ✅ |
| `broadcast(event, payload, sender?): void` | 向所有连接中的客户端推送系统消息或自定义消息。sender 为 PeerCSMember 类型，未传时默认为 Server 自身 | ✅ |
| `send(event, clientId, payload): void` | 向指定客户端推送系统消息或自定义消息 | ✅ |
| `on(event, callback)` | 监听消息 | ✅ |
| `off(event, callback?)` | 取消监听消息 | ✅ |

**Server 自动广播**：当 Client 通过 `send(event, payload, { broadcast: true })` 发送消息时，Server 收到后会自动调用 `broadcast(event, payload, sender)` 将此消息广播给**所有已连接的 Client（含发送者自身）**，其中 `sender` 为来源客户端的 `PeerCSMember` 信息。未指定 `sender` 时默认为 Server 自身。

**Server 端广播控制**：Server 可通过 `options` 控制哪些事件允许 Client 广播，未配置时默认**拒绝所有广播**。

- **`broadcastAllowlist: string[]`** — 事件名白名单，仅名单内的事件才会被广播转发。
- **`broadcastValidator: (event, payload, conn) => boolean`** — 自定义校验函数，接收事件名、载荷和来源连接，返回 `true` 允许广播。

两者同时设置时需**同时满足**才放行。

```javascript
const server = new PeerCS.Server('my-server', 'my-server-id', {
    broadcastAllowlist: ['u:chat', 'u:move'],
    broadcastValidator: (event, payload, conn) => event.startsWith('u:'),
});
```

### PeerCS.Client/客户端

| 方法 | 说明 | 状态 |
| --- | --- | --- |
| `constructor(serverId, name, id?, options?): PeerCS.Client` | 初始化客户端。options 支持 `debug: true` 开启调试日志 | ✅ |
| `connect(): Promise<void>` | 开始连接服务端 （初始化Peer），异步等待就绪 | ✅ |
| `disconnect(): void` | 断开服务端连接 | ✅ |
| `send(event, payload): void` | 向服务端推送消息（仅 Server 收到） | ✅ |
| `send(event, payload, { broadcast: true })` | 向服务端推送消息，并请求 Server 广播给所有 Client | ✅ |
| `on(event, callback)` | 监听消息 | ✅ |
| `off(event, callback?)` | 取消监听消息 | ✅ |

## 🔄 数据同步模式

PeerCS-Core 推荐 Client-Server 架构下的统一数据同步模式：

```
Client A ──send(event, payload, { broadcast: true })──▶ Server
                                                          │
                                     broadcast(event, payload, sender)
                                                          │
                              ┌───────────────────────────┼───────────────────────────┐
                              ▼                           ▼                           ▼
                          Client A                   Client B                   Client C
                       (收到自身消息,            (收到同步数据,             (收到同步数据,
                        sender = A)              sender = A)               sender = A)
```

- **Client 只与 Server 通信**，不直接与其他 Client 通信
- 需要同步的消息通过 `{ broadcast: true }` 声明，Server 收到后自动转发给所有 Client（含 `sender` 来源信息）
- **所有 Client（含发送者自身）统一在收到广播后才进行本地处理**（方案A）
- 发送者可通过 `sender.id === getPid()` 识别是否为自身消息

## 风险点

- 安全风险：本项目期望实现基于信任前提下，自由构建 C/S 架构网络连接，从而可以更容易的构建能力利用其优势的应用。
- 技术限制1：本项目基于 PeerJS 实现，受限于 PeerJS 本身的技术限制，如：多人共用 ID （全局唯一）可能会产生冲突，依赖信令服务器等。
- 技术限制2：本项目所基于 PeerJS 技术底层通过 WebRTC 技术实现，受限于 WebRTC 本身的技术限制，如：网络与协议限制可能造成连接失败，单个中心节点（特别是基于浏览器的）所能够支持连接的节点数有限（实际最高可能在几十左右）等。


## 📜 开源协议

MIT License.






