import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server } from './index';
import { Peer } from 'peerjs';

vi.mock('peerjs');

describe('Server', () => {
    let server: Server;
    let mockPeer: any;
    let peerEvents: Record<string, (...args: unknown[]) => void> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        peerEvents = {};

        mockPeer = {
            on: vi.fn((event, cb) => {
                peerEvents[event] = cb;
            }),
            destroy: vi.fn(),
            id: 'test-id',
        };

        vi.mocked(Peer).mockImplementation(() => mockPeer);
        server = new Server('test-server', 'test-id');
    });

    it('should initialize with correct name and id', () => {
        expect(server.name).toBe('test-server');
        expect(server.id).toBe('test-id');
    });

    it('should start and initialize Peer', async () => {
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        expect(Peer).toHaveBeenCalledWith('test-id', undefined);
        expect(mockPeer.on).toHaveBeenCalledWith('open', expect.any(Function));
        expect(mockPeer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should handle incoming connections', async () => {
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            metadata: { name: 'Client 1' },
            on: vi.fn((event, cb) => {
                connEvents[event] = cb;
            }),
            send: vi.fn(),
            close: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        // Server only tracks connection after it's 'open'
        connEvents['open']();

        expect(server.getConnectionIds()).toContain('client-1');
        const conn = server.getConnection('client-1');
        expect(conn?.name).toBe('Client 1');
    });

    it('should emit event when data is received', async () => {
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            metadata: { name: 'Client 1' },
            on: vi.fn((event, cb) => {
                connEvents[event] = cb;
            }),
            send: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        connEvents['open']();

        const dataHandler = connEvents['data'];

        const callback = vi.fn();
        server.on('u:test', callback);

        dataHandler({ event: 'u:test', payload: 'hello' });
        expect(callback).toHaveBeenCalledWith(expect.anything(), 'hello');
    });

    it('should handle messages and broadcast without sender', async () => {
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            metadata: { name: 'Client 1' },
            on: vi.fn((event, cb) => {
                connEvents[event] = cb;
            }),
            send: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        connEvents['open']();
        vi.clearAllMocks();

        const callback = vi.fn();
        server.on('u:test', callback);

        server.broadcast('s:chat', 'welcome');
        expect(mockConn.send).toHaveBeenCalledWith(expect.objectContaining({
            event: 's:chat',
            payload: 'welcome'
        }));
        const sentPacket = mockConn.send.mock.calls[0][0];
        expect(sentPacket.timestamp).toBeDefined();
        expect(sentPacket.sender).toEqual({ id: 'test-id', name: 'test-server', isHost: true });
    });

    it('should broadcast with sender info', async () => {
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            metadata: { name: 'Client 1' },
            on: vi.fn((event, cb) => {
                connEvents[event] = cb;
            }),
            send: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        connEvents['open']();
        vi.clearAllMocks();

        server.broadcast('u:move', { x: 10, y: 20 }, { id: 'alice', name: 'Alice' });
        expect(mockConn.send).toHaveBeenCalledWith(expect.objectContaining({
            event: 'u:move',
            payload: { x: 10, y: 20 },
            sender: { id: 'alice', name: 'Alice' }
        }));
    });

    it('should auto-broadcast with sender when broadcast flag is set', async () => {
        server = new Server('test-server', 'test-id', {
            broadcastAllowlist: ['u:chat'],
        });
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            metadata: { name: 'Client 1' },
            on: vi.fn((event, cb) => {
                connEvents[event] = cb;
            }),
            send: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        connEvents['open']();
        vi.clearAllMocks();

        const dataHandler = connEvents['data'];
        dataHandler({
            event: 'u:chat',
            payload: { text: 'Hello' },
            broadcast: true
        });

        expect(mockConn.send).toHaveBeenCalledWith(expect.objectContaining({
            event: 'u:chat',
            payload: { text: 'Hello' },
            sender: { id: 'client-1', name: 'Client 1', isHost: false }
        }));
    });

    it('should block broadcast when event is not in allowlist', async () => {
        server = new Server('test-server', 'test-id', {
            broadcastAllowlist: ['u:allowed'],
        });
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            metadata: { name: 'Client 1' },
            on: vi.fn((event, cb) => { connEvents[event] = cb; }),
            send: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        connEvents['open']();
        vi.clearAllMocks();

        const dataHandler = connEvents['data'];
        dataHandler({
            event: 'u:blocked',
            payload: { text: 'Should not broadcast' },
            broadcast: true,
        });

        expect(mockConn.send).not.toHaveBeenCalled();
    });

    it('should allow broadcast when event is in allowlist', async () => {
        server = new Server('test-server', 'test-id', {
            broadcastAllowlist: ['u:allowed'],
        });
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            metadata: { name: 'Client 1' },
            on: vi.fn((event, cb) => { connEvents[event] = cb; }),
            send: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        connEvents['open']();
        vi.clearAllMocks();

        const dataHandler = connEvents['data'];
        dataHandler({
            event: 'u:allowed',
            payload: { text: 'Hello' },
            broadcast: true,
        });

        expect(mockConn.send).toHaveBeenCalledWith(expect.objectContaining({
            event: 'u:allowed',
            payload: { text: 'Hello' },
            sender: { id: 'client-1', name: 'Client 1', isHost: false },
        }));
    });

    it('should block broadcast when validator returns false', async () => {
        server = new Server('test-server', 'test-id', {
            broadcastAllowlist: ['u:chat'],
            broadcastValidator: () => false,
        });
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            metadata: { name: 'Client 1' },
            on: vi.fn((event, cb) => { connEvents[event] = cb; }),
            send: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        connEvents['open']();
        vi.clearAllMocks();

        const dataHandler = connEvents['data'];
        dataHandler({
            event: 'u:chat',
            payload: { text: 'Hello' },
            broadcast: true,
        });

        expect(mockConn.send).not.toHaveBeenCalled();
    });

    it('should allow broadcast when validator returns true', async () => {
        server = new Server('test-server', 'test-id', {
            broadcastAllowlist: ['u:chat'],
            broadcastValidator: (event) => event.startsWith('u:'),
        });
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            metadata: { name: 'Client 1' },
            on: vi.fn((event, cb) => { connEvents[event] = cb; }),
            send: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        connEvents['open']();
        vi.clearAllMocks();

        const dataHandler = connEvents['data'];
        dataHandler({
            event: 'u:chat',
            payload: { text: 'Hello' },
            broadcast: true,
        });

        expect(mockConn.send).toHaveBeenCalledWith(expect.objectContaining({
            event: 'u:chat',
            sender: { id: 'client-1', name: 'Client 1', isHost: false },
        }));
    });

    it('should require both allowlist and validator to pass', async () => {
        server = new Server('test-server', 'test-id', {
            broadcastAllowlist: ['u:chat'],
            broadcastValidator: (event) => event.startsWith('u:'),
        });
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            metadata: { name: 'Client 1' },
            on: vi.fn((event, cb) => { connEvents[event] = cb; }),
            send: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        connEvents['open']();
        vi.clearAllMocks();

        const dataHandler = connEvents['data'];
        dataHandler({
            event: 'u:chat',
            payload: { text: 'Hello' },
            broadcast: true,
        });

        expect(mockConn.send).toHaveBeenCalledWith(expect.objectContaining({
            event: 'u:chat',
            sender: { id: 'client-1', name: 'Client 1', isHost: false },
        }));
    });

    it('should handle disconnection', async () => {
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            on: vi.fn((event, cb) => {
                connEvents[event] = cb;
            }),
            send: vi.fn(),
            close: vi.fn(),
        };

        peerEvents['connection'](mockConn);
        connEvents['open']();

        const closeHandler = connEvents['close'];

        const disconnectSpy = vi.fn();
        server.on('p:disconnected', disconnectSpy);

        closeHandler();
        expect(server.getConnections().size).toBe(0);
        expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should kick a client', async () => {
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        const connEvents: Record<string, (...args: unknown[]) => void> = {};
        const mockConn: any = {
            peer: 'client-1',
            on: vi.fn((event, cb) => {
                connEvents[event] = cb;
            }),
            send: vi.fn(),
            close: vi.fn(),
        };
        peerEvents['connection'](mockConn);
        connEvents['open']();

        server.kick('client-1');
        expect(mockConn.close).toHaveBeenCalled();
    });

    it('should shutdown and cleanup', async () => {
        const startPromise = server.start();
        peerEvents['open']('test-id');
        await startPromise;
        server.shutdown();
        expect(mockPeer.destroy).toHaveBeenCalled();
        expect(server.getConnections().size).toBe(0);
    });
});
