import { describe, it, expect } from 'vitest';
import * as PeerCS from './index';

describe('PeerCS-Core Initialization', () => {
    it('should export necessary components', () => {
        expect(PeerCS).toBeDefined();
        expect(PeerCS.Server).toBeDefined();
        expect(PeerCS.Client).toBeDefined();
    });
});
