import { Peer } from 'peerjs';
import { PeerCSData, PeerCSConnection, PeerCSCallback, PeerCSOptions } from '../types';

export class Client {
    private peer: Peer | null = null;
    private conn: PeerCSConnection | null = null;
    private events: Map<string, PeerCSCallback[]> = new Map();
    private debug: boolean;
    private peerOptions: Record<string, unknown>;

    constructor(
        public serverId: string,
        public name: string,
        public id?: string,
        options?: PeerCSOptions,
    ) {
        this.debug = options?.debugLog ?? false;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { debugLog, ...rest } = options || {};
        this.peerOptions = Object.keys(rest).length > 0 ? rest : undefined as unknown as Record<string, unknown>;
    }

    async connect(): Promise<void> {
        if (this.peer) return;

        if (this.debug) console.debug('[PeerCS][Client] Initializing Peer with id:', this.id);
        this.peer = new Peer(this.id || '', this.peerOptions);

        this.peer.on('error', (err) => {
            if (this.debug) console.debug('[PeerCS][Client] Peer error:', err);
            this.emit('p:error', err);
        });

        await new Promise<void>((resolve, reject) => {
            if (!this.peer) return reject(new Error('Peer not initialized'));

            const timeout = setTimeout(() => reject(new Error('Connect timeout')), 30000);

            this.peer!.on('open', (id) => {
                clearTimeout(timeout);
                this.id = id;
                if (this.debug) console.debug('[PeerCS][Client] Peer opened with id:', id);
                this.emit('p:connected', id);
                this.internalConnect().then(resolve).catch(reject);
            });
        });
    }

    private internalConnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.peer) return reject(new Error('Peer not initialized'));

            if (this.debug) console.debug('[PeerCS][Client] Connecting to server:', this.serverId);
            const rawConn = this.peer.connect(this.serverId, {
                metadata: { name: this.name },
            });

            this.conn = rawConn as PeerCSConnection;

            this.conn.on('open', () => {
                if (this.conn) {
                    this.conn.id = this.conn.peer;
                    this.conn.name = this.name;
                    if (this.debug) console.debug('[PeerCS][Client] Connected to server:', this.conn.id);
                    this.emit('p:connection', this.conn);
                }
                resolve();
            });

            this.conn.on('data', (data: unknown) => {
                const packet = data as PeerCSData;
                if (this.debug) console.debug('[PeerCS][Client] Received data:', packet.event, packet.payload);
                this.emit(packet.event, this.conn, packet.payload, packet.sender);
            });

            this.conn.on('close', () => {
                if (this.debug) console.debug('[PeerCS][Client] Connection closed');
                this.emit('p:disconnected', this.conn);
            });

            this.conn.on('error', (err) => {
                if (this.debug) console.debug('[PeerCS][Client] Connection error:', err);
                this.emit('p:error', err);
                reject(err);
            });
        });
    }

    disconnect(): void {
        if (this.debug) console.debug('[PeerCS][Client] Disconnecting from server');
        if (this.conn) {
            this.conn.close();
            this.conn = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
    }

    send(event: string, payload: unknown, options?: { broadcast?: boolean }): void {
        if (!this.conn) {
            throw new Error('Not connected to server. Call connect() first.');
        }
        if (this.debug) console.debug('[PeerCS][Client] Sending:', event, payload, options);
        const packet: PeerCSData = { event, payload, timestamp: Date.now(), broadcast: options?.broadcast };
        this.conn.send(packet);
    }

    on(event: string, callback: PeerCSCallback): void {
        if (this.debug) console.debug('[PeerCS][Client] Registering listener for:', event);
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)?.push(callback);
    }

    off(event: string, callback?: PeerCSCallback): void {
        if (this.debug) console.debug('[PeerCS][Client] Removing listener for:', event);
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

    /** @internal */
    private emit(event: string, ...args: unknown[]): void {
        this.events.get(event)?.forEach((cb) => cb(...args));
    }
}
