import { Peer, type DataConnection } from 'peerjs';
import { PeerCSData, PeerCSConnection, PeerCSCallback, PeerCSOptions, PeerCSMember } from '../types';

export class Server {
    private peer: Peer | null = null;
    private connections: Set<PeerCSConnection> = new Set();
    private events: Map<string, PeerCSCallback[]> = new Map();
    private debug: boolean;
    private peerOptions: Record<string, unknown>;
    private broadcastAllowlist?: string[];
    private broadcastValidator?: (event: string, payload: unknown, conn: PeerCSConnection) => boolean;

    constructor(
        public name: string,
        public id?: string,
        options?: PeerCSOptions,
    ) {
        this.debug = options?.debugLog ?? false;
        this.broadcastAllowlist = options?.broadcastAllowlist;
        this.broadcastValidator = options?.broadcastValidator;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { debugLog, broadcastAllowlist, broadcastValidator, ...rest } = options || {};
        this.peerOptions = Object.keys(rest).length > 0 ? rest : undefined as unknown as Record<string, unknown>;
    }

    start(): Promise<void> {
        if (this.peer) return Promise.resolve();
        if (this.debug) console.debug('[PeerCS][Server] Initializing Peer with id:', this.id);
        this.peer = new Peer(this.id || '', this.peerOptions);

        this.peer.on('connection', (rawConn: DataConnection) => {
            const conn = rawConn as PeerCSConnection;
            conn.id = conn.peer;
            conn.name = conn.metadata?.name || 'Anonymous';

            if (this.debug) console.debug('[PeerCS][Server] Incoming connection attempt from:', conn.id, conn.name);
            this.emit('p:connection_attempt', conn);

            conn.on('open', () => {
                this.connections.add(conn);
                if (this.debug) console.debug('[PeerCS][Server] Connection established:', conn.id, conn.name);
                this.emit('p:connection', conn);
                this.broadcastConnectionList();
            });

            conn.on('data', (data: unknown) => {
                const packet = data as PeerCSData;
                if (this.debug) console.debug('[PeerCS][Server] Received data:', packet.event, packet.payload);
                this.emit(packet.event, conn, packet.payload);
                if (packet.broadcast && this.canBroadcast(packet.event, packet.payload, conn)) {
                    if (this.debug) console.debug('[PeerCS][Server] Broadcasting relayed event:', packet.event, `from ${conn.name}`);
                    this.broadcast(packet.event, packet.payload, { id: conn.id, name: conn.name, isHost: false });
                }
            });

            conn.on('close', () => {
                if (this.debug) console.debug('[PeerCS][Server] Connection closed:', conn.id, conn.name);
                this.handleDisconnect(conn);
                this.broadcastConnectionList();
            });

            conn.on('error', (err) => {
                if (this.debug) console.debug('[PeerCS][Server] Connection error:', conn.id, err);
                this.emit('p:error', conn, err);
            });
        });

        this.peer.on('error', (err) => {
            if (this.debug) console.debug('[PeerCS][Server] Peer error:', err);
            this.emit('p:error', null, err);
        });

        return new Promise<void>((resolve, reject) => {
            if (!this.peer) return reject(new Error('Peer not initialized'));

            const timeout = setTimeout(() => reject(new Error('Server start timeout')), 30000);

            this.peer!.on('open', (id) => {
                clearTimeout(timeout);
                this.id = id;
                if (this.debug) console.debug('[PeerCS][Server] Peer opened with id:', id);
                this.emit('p:connected', id);
                this.broadcastConnectionList();
                resolve();
            });
        });
    }

    private handleDisconnect(conn: PeerCSConnection): void {
        if (this.connections.has(conn)) {
            this.connections.delete(conn);
            if (this.debug) console.debug('[PeerCS][Server] Client disconnected:', conn.id, conn.name);
            this.emit('p:disconnected', conn);
            this.broadcastConnectionList();
        }
    }

    private broadcastConnectionList(): void {
        const members = Array.from(this.connections).map(c => ({
            id: c.id,
            name: c.name
        }));
        const list = [{ id: this.id as string, name: this.name, isHost: true }, ...members];
        this.broadcast('s:connection_list', list);
        this.emit('s:connection_list', null, list);
    }

    private canBroadcast(event: string, payload: unknown, conn: PeerCSConnection): boolean {
        if (!this.broadcastAllowlist || !this.broadcastAllowlist.includes(event)) {
            if (this.debug) console.debug('[PeerCS][Server] Broadcast blocked by allowlist:', event);
            return false;
        }
        if (this.broadcastValidator && !this.broadcastValidator(event, payload, conn)) {
            if (this.debug) console.debug('[PeerCS][Server] Broadcast blocked by validator:', event);
            return false;
        }
        return true;
    }

    shutdown(): void {
        if (!this.peer) return;
        if (this.debug) console.debug('[PeerCS][Server] Shutting down, closing', this.connections.size, 'connections');
        this.connections.forEach((conn) => conn.close());
        this.connections.clear();
        this.peer.destroy();
        this.peer = null;
    }

    getConnectionIds(): string[] {
        return Array.from(this.connections).map((c) => c.id);
    }

    getConnections(): Set<PeerCSConnection> {
        return this.connections;
    }

    getConnection(clientId: string): PeerCSConnection | undefined {
        return Array.from(this.connections).find((c) => c.id === clientId);
    }

    kick(clientId: string): void {
        const conn = this.getConnection(clientId);
        if (!conn) {
            throw new Error(`Client not found: ${clientId}`);
        }
        if (this.debug) console.debug('[PeerCS][Server] Kicking client:', clientId);
        conn.close();
    }

    broadcast(event: string, payload: unknown, sender?: PeerCSMember): void {
        if (!this.peer) {
            throw new Error('Server not started. Call start() first.');
        }
        const src = sender ?? { id: this.id as string, name: this.name, isHost: true };
        if (this.debug) console.debug('[PeerCS][Server] Broadcasting:', event, payload, `from ${src.name}`);
        const packet: PeerCSData = { event, payload, timestamp: Date.now(), sender: src };
        this.connections.forEach((conn) => conn.send(packet));
    }

    send(event: string, clientId: string, payload: unknown): void {
        if (!this.peer) {
            throw new Error('Server not started. Call start() first.');
        }
        const conn = this.getConnection(clientId);
        if (!conn) {
            throw new Error(`Client not found: ${clientId}`);
        }
        if (this.debug) console.debug('[PeerCS][Server] Sending to', clientId, ':', event, payload);
        const packet: PeerCSData = { event, payload, timestamp: Date.now(), sender: { id: this.id as string, name: this.name, isHost: true } };
        conn.send(packet);
    }

    on(event: string, callback: PeerCSCallback): void {
        if (this.debug) console.debug('[PeerCS][Server] Registering listener for:', event);
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)?.push(callback);
    }

    off(event: string, callback?: PeerCSCallback): void {
        if (this.debug) console.debug('[PeerCS][Server] Removing listener for:', event);
        if (!callback) {
            this.events.delete(event);
            return;
        }
        const callbacks = this.events.get(event);
        if (callbacks) {
            this.events.set(
                event,
                callbacks.filter((cb) => cb !== callback),
            );
        }
    }

    private emit(event: string, ...args: unknown[]): void {
        this.events.get(event)?.forEach((cb) => cb(...args));
    }
}
