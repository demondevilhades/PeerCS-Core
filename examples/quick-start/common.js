mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose'
});

let currentRole = null; // 'server' or 'client'

async function updateState(nodeId, description) {
    const descEl = document.getElementById('current-state-desc');
    if (descEl) descEl.textContent = `Current state: ${description}`;

    const container = document.getElementById('diagram-container');

    if (!currentRole) {
        container.innerHTML = '<div style="text-align:center; padding:2rem; color:#9ca3af; font-size:0.9rem;">Select a role to start state monitoring</div>';
        return;
    }

    let graphDef = '';
    if (currentRole === 'server') {
        graphDef = [
            'stateDiagram-v2',
            '    [*] --> S_Init : "start()"',
            '    S_Init --> S_Ready : "p_connected"',
            '    S_Ready --> [*] : "shutdown()"',
            '    classDef curr fill:#4f46e5,color:#fff,stroke-width:2px',
            `    class ${nodeId} curr`
        ].join('\n');
    } else if (currentRole === 'client') {
        graphDef = [
            'stateDiagram-v2',
            '    [*] --> C_Init : "connect()"',
            '    C_Init --> C_Connecting : "p_connected"',
            '    C_Connecting --> C_Connected : "p_connection"',
            '    C_Connected --> [*] : "disconnect()"',
            '    classDef curr fill:#4f46e5,color:#fff,stroke-width:2px',
            nodeId ? `    class ${nodeId} curr` : ''
        ].filter(Boolean).join('\n');
    }

    console.log('graphDef: ', graphDef);

    try {
        const { svg } = await mermaid.render(`m-graph-${Math.random().toString(36).substr(2, 9)}`, graphDef);
        container.innerHTML = svg;
    } catch (e) {
        console.error('Mermaid render error:', e);
    }
}

function log(containerId, message) {
    const container = document.getElementById(containerId);
    const entry = document.createElement('div');
    entry.style.marginBottom = '4px';
    entry.innerHTML = `<span style="color:#71717a">[${new Date().toLocaleTimeString()}]</span> ${message}`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

function updateRoomUI(members) {
    const listEl = document.getElementById('member-list');
    if (!listEl) return;
    listEl.innerHTML = members.map(m => `
        <div style="display: flex; align-items: center; justify-content: space-between; background: #f9fafb; padding: 0.5rem; border-radius: 6px; border: 1px solid #e5e7eb;">
            <span style="font-weight: 500;" class="badge" data-role="${(m.isHost ? 'host' : (m.me ? 'me' : null))}">${m.name}${m.isHost ? ' [Host]' : ''}${m.me ? ' [Me]' : ''}</span>
            <code style="font-size: 0.75rem; color: #6b7280;">${m.id}</code>
        </div>
    `).join('');
}

function resetUI() {
    document.getElementById('setup').style.display = 'flex';
    document.getElementById('server-view').style.display = 'none';
    document.getElementById('client-view').style.display = 'none';
    document.getElementById('room-card').style.display = 'none';
    document.getElementById('state-card').style.display = 'none';
    document.getElementById('member-list').innerHTML = '';
    document.getElementById('app-title').textContent = 'PeerCS-Core Quick Start';
    currentRole = null;
    updateState(null, 'Welcome to PeerCS-Core');
}

function startServer() {
    const name = document.getElementById('nodeName').value || 'Server';
    document.getElementById('setup').style.display = 'none';
    document.getElementById('server-view').style.display = 'block';
    document.getElementById('server-setup').style.display = 'block';
    document.getElementById('server-active').style.display = 'none';
    document.getElementById('server-log').style.display = 'none';
    document.getElementById('room-card').style.display = 'block';
    document.getElementById('state-card').style.display = 'block';
    document.getElementById('app-title').textContent = `Server Mode: ${name}`;
    window.serverName = name;
    updateRoomUI([{ id: 'Local', name: name, isHost: true, me: true }]);
    currentRole = 'server';
    updateState(null, 'Ready to start server');
}

function peerOptions() {
    const peerServerInput = document.getElementById('PeerServer').value.trim();
    const peerPath = document.getElementById('PeerPath').value.trim() || '/peerjs';
    const peerSecure = document.getElementById('PeerSecure').checked;
    const isPort = /\d+$/.test(peerServerInput);
    return {
            host: isPort ? peerServerInput.split(':')[0] : peerServerInput,
            port: isPort ? parseInt(peerServerInput.split(':')[1]) : undefined,
            path: peerPath || '/peerjs',
            secure: peerSecure || false
        };
}

function runServer() {
    updateState('S_Init', 'Initializing Peer...');

    initServer(window.serverName, null, peerOptions(), (id) => {
        document.getElementById('server-setup').style.display = 'none';
        document.getElementById('server-active').style.display = 'block';
        document.getElementById('server-log').style.display = 'block';
        document.getElementById('server-id-display').textContent = id;
        updateState('S_Ready', 'Server ready, waiting for connections');
        log('server-log', `<b>Server started</b> with ID: <code>${id}</code>`);
    }, (msg) => {
        log('server-log', msg);
        if (msg.includes('s_chat')) {
            const desc = 'Received and broadcast message';
            const descEl = document.getElementById('current-state-desc');
            if (descEl) descEl.textContent = `Current state: ${desc}`;
        }
        if (msg.includes('Server shutdown')) resetUI();
    });
}

function stopServer() {
    if (window.shutdownServer) {
        window.shutdownServer();
        log('server-log', '<b style="color:#ef4444">Server shutting down...</b>');
        updateState(null, 'Server shut down');
        setTimeout(resetUI, 1000);
    }
}

function startClient() {
    const name = document.getElementById('nodeName').value || 'Client';
    document.getElementById('setup').style.display = 'none';
    document.getElementById('client-view').style.display = 'block';
    document.getElementById('client-setup').style.display = 'block';
    document.getElementById('client-chat').style.display = 'none';
    document.getElementById('room-card').style.display = 'block';
    document.getElementById('state-card').style.display = 'block';
    document.getElementById('app-title').textContent = `Client Mode: ${name}`;
    window.clientName = name;
    updateRoomUI([{ id: 'Local', name: name, me: true }]);
    currentRole = 'client';
    updateState(null, 'Waiting for Server ID');
}

function connectToServer() {
    const serverId = document.getElementById('targetServerId').value;
    if (!serverId) return alert('Please enter a valid Server ID');

    updateState('C_Init', 'Initializing local Peer...');

    initClient(window.clientName, serverId, peerOptions(), () => {
        document.getElementById('client-setup').style.display = 'none';
        document.getElementById('client-chat').style.display = 'block';
        updateState('C_Connected', 'Connected, you can now send messages');
        log('client-log', `<b style="color:#059669">Connected to server</b>`);
    }, (msg) => {
        log('client-log', msg);
        if (msg.includes('initialized')) updateState('C_Connecting', 'Peer ready, connecting to Server...');
        if (msg.includes(': ') && !msg.includes('connected') && !msg.includes('Disconnected') && !msg.includes('initialized') && !msg.includes('Error')) {
            const desc = 'Received server broadcast';
            const descEl = document.getElementById('current-state-desc');
            if (descEl) descEl.textContent = `Current state: ${desc}`;
        }
        if (msg.includes('Disconnected')) {
            document.getElementById('client-setup').style.display = 'block';
            document.getElementById('client-chat').style.display = 'none';
            updateState(null, 'Disconnected');
        }
    });
}

function disconnectClient() {
    if (window.clientDisconnect) {
        window.clientDisconnect();
        updateState(null, 'Disconnecting...');
    }
}

function sendMessage() {
    const content = document.getElementById('msgContent').value;
    if (!content) return;
    clientSend(content);
    document.getElementById('msgContent').value = '';
    const desc = 'Waiting for server broadcast...';
    const descEl = document.getElementById('current-state-desc');
    if (descEl) descEl.textContent = `Current state: ${desc}`;
}
window.onload = () => {
    updateState(null, '');
};