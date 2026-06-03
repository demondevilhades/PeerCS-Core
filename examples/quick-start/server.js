let server;

function initServer(name, serverId, peerOptions, onReady, onLog) {
    const finalServerId = serverId || 'server-' + Math.random().toString(36).substr(2, 6);

    server = new PeerCS.Server(name, finalServerId, peerOptions);

    server.on('p:connected', (id) => {
        onLog(`Server ready. ID: ${id}`);
        onReady(id);
    });

    server.on('p:connection_attempt', (conn) => {
        onLog(`Incoming connection attempt from: ${conn.id}`);
    });

    server.on('p:connection', (conn) => {
        onLog(`Client connected: ${conn.id} [${conn.name}]`);
    });

    server.on('p:disconnected', (conn) => {
        onLog(`Client disconnected: ${conn.id}`);
    });

    server.on('s:connection_list', (conn, list) => {
        list.forEach(m => {
            if (server && m.id == serverId) {
                m.me = true;
            }
        });
        updateRoomUI(list);
    });

    server.on('s:chat', (conn, payload) => {
        onLog(`${conn.name}: ${payload.text}`);
        // Auto-broadcast with sender info handles distribution to all clients
    });

    server.on('p:error', (conn, err) => {
        onLog(`Error: ${err.message || err}`);
    });

    server.start().catch(err => onLog(`Start failed: ${err.message}`));

    window.shutdownServer = () => {
        if (server) {
            server.shutdown();
            server = null;
            onLog('Server shutdown by user.');
        }
    };
}
