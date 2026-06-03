let client;

function initClient(name, serverId, peerOptions, onConnected, onLog) {

    client = new PeerCS.Client(serverId, name, undefined, peerOptions);

    client.on('p:connected', (id) => {
        onLog(`Client Peer initialized. My Peer ID: ${id}`);
    });

    client.on('p:connection', (conn) => {
        onLog(`Successfully connected to server.`);
        onConnected();
    });

    client.on('s:chat', (conn, payload, sender) => {
        onLog(`${sender?.name || conn.name}: ${payload.text}`);
    });

    client.on('s:connection_list', (conn, list) => {
        list.forEach(m => {
            if (client && m.id == client.id) {
                m.me = true;
            }
        });
        updateRoomUI(list);
    });

    client.on('p:disconnected', () => {
        onLog(`Disconnected from server.`);
    });

    client.on('p:error', (err) => {
        onLog(`Error: ${err.message || err}`);
    });

    client.connect().catch(err => onLog(`Connect failed: ${err.message}`));

    window.clientDisconnect = () => {
        if (client) {
            client.disconnect();
            client = null;
            onLog('Disconnected by user.');
        }
    };
}

function clientSend(text) {
    if (client) {
        client.send('s:chat', { text }, { broadcast: true });
    }
}
