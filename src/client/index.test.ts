import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Peer } from 'peerjs';

vi.mock('peerjs');

import { Client } from './index';

describe('Client', () => {
    let client: Client;
    let mockPeer: any;
    let mockConn: any;
    let peerEvents: Record<string, (...args: unknown[]) => void> = {};
    let connEvents: Record<string, (...args: unknown[]) => void> = {};
    const serverId = 'test-server-id';
    const clientName = 'test-client';

    beforeEach(() => {
        vi.clearAllMocks();
        peerEvents = {};
        connEvents = {};

        mockConn = {
            on: vi.fn((event, cb) => {
                connEvents[event] = cb;
            }),
            send: vi.fn(),
            close: vi.fn(),
            peer: serverId,
        };

        mockPeer = {
            on: vi.fn((event, cb) => {
                peerEvents[event] = cb;
            }),
            connect: vi.fn().mockReturnValue(mockConn),
            destroy: vi.fn(),
            id: 'mock-client-id',
        };

        vi.mocked(Peer).mockImplementation(() => mockPeer);
        client = new Client(serverId, clientName);
    });

    it('should initialize with correct serverId and name', () => {
        expect(client.serverId).toBe(serverId);
        expect(client.name).toBe(clientName);
    });

    it('should connect to the server', async () => {
        const connectPromise = client.connect();
        // Trigger peer open
        peerEvents['open']('mock-client-id');
        // Trigger connection open
        connEvents['open']();
        await connectPromise;

        expect(Peer).toHaveBeenCalled();
        expect(mockPeer.connect).toHaveBeenCalledWith(serverId, expect.objectContaining({
            metadata: { name: clientName }
        }));
    });

    it('should send messages to the server', async () => {
        const connectPromise = client.connect();
        peerEvents['open']('mock-client-id');
        connEvents['open']();
        await connectPromise;

        client.send('u:chat', 'Hello Server');

        expect(mockConn.send).toHaveBeenCalledWith(expect.objectContaining({
            event: 'u:chat',
            payload: 'Hello Server'
        }));
    });

    it('should handle incoming messages', async () => {
        const connectPromise = client.connect();
        peerEvents['open']('mock-client-id');
        connEvents['open']();
        await connectPromise;

        const callback = vi.fn();
        client.on('u:test', callback);

        // Trigger data event via mock connection
        connEvents['data']({ event: 'u:test', payload: 'test payload' });
        expect(callback).toHaveBeenCalledWith(expect.anything(), 'test payload', undefined);
    });

    it('should pass sender info when present in packet', async () => {
        const connectPromise = client.connect();
        peerEvents['open']('mock-client-id');
        connEvents['open']();
        await connectPromise;

        const callback = vi.fn();
        client.on('u:chat', callback);

        connEvents['data']({
            event: 'u:chat',
            payload: { text: 'Hello' },
            sender: { id: 'alice-1', name: 'Alice' }
        });
        expect(callback).toHaveBeenCalledWith(
            expect.anything(),
            { text: 'Hello' },
            { id: 'alice-1', name: 'Alice' }
        );
    });

    it('should handle disconnection', async () => {
        const connectPromise = client.connect();
        peerEvents['open']('mock-client-id');
        connEvents['open']();
        await connectPromise;

        const disconnectSpy = vi.fn();
        client.on('p:disconnected', disconnectSpy);

        // Trigger close event via mock connection
        connEvents['close']();
        expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should disconnect from the server manually', async () => {
        const connectPromise = client.connect();
        peerEvents['open']('mock-client-id');
        connEvents['open']();
        await connectPromise;

        client.disconnect();

        expect(mockConn.close).toHaveBeenCalled();
        expect(mockPeer.destroy).toHaveBeenCalled();
    });
});
