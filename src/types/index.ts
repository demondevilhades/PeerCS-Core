import { type DataConnection } from 'peerjs';

export interface PeerCSData {
    event: string;
    payload: unknown;
    timestamp: number;
    broadcast?: boolean;
    sender?: PeerCSMember;
}

export interface PeerCSConnection extends DataConnection {
    id: string;
    name: string;
}

export interface PeerCSMember {
    id: string;
    name: string;
    isHost?: boolean;
}

export type PeerCSCallback = (...args: unknown[]) => void;

export interface PeerCSOptions {
    debugLog?: boolean;
    broadcastAllowlist?: string[];
    broadcastValidator?: (event: string, payload: unknown, conn: PeerCSConnection) => boolean;
    [key: string]: unknown;
}
