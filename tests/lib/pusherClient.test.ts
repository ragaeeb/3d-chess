import { beforeEach, describe, expect, mock, test } from 'bun:test';

class FakePusher {
    constructor(
        public key: string,
        public options: Record<string, unknown>,
    ) {}
}

mock.module('pusher-js', () => ({ default: FakePusher }));

const { createPusherClient } = await import('@/lib/pusherClient');

describe('createPusherClient', () => {
    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_PUSHER_KEY;
        delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    });

    test('throws when the public key is missing', () => {
        delete process.env.NEXT_PUBLIC_PUSHER_KEY;
        process.env.NEXT_PUBLIC_PUSHER_CLUSTER = 'mt1';
        expect(() => createPusherClient('abc')).toThrow('NEXT_PUBLIC_PUSHER_KEY');
    });

    test('throws when the cluster is missing', () => {
        process.env.NEXT_PUBLIC_PUSHER_KEY = 'key';
        delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
        expect(() => createPusherClient('abc')).toThrow('NEXT_PUBLIC_PUSHER_CLUSTER');
    });

    test('throws when playerId is empty', () => {
        process.env.NEXT_PUBLIC_PUSHER_KEY = 'key';
        process.env.NEXT_PUBLIC_PUSHER_CLUSTER = 'mt1';
        expect(() => createPusherClient('')).toThrow('playerId');
    });

    test('creates a client with the expected options', () => {
        process.env.NEXT_PUBLIC_PUSHER_KEY = 'key';
        process.env.NEXT_PUBLIC_PUSHER_CLUSTER = 'mt1';
        const client = createPusherClient('player-123') as unknown as FakePusher;
        expect(client).toBeInstanceOf(FakePusher);
        expect(client.key).toBe('key');
        expect(client.options).toEqual(
            expect.objectContaining({
                cluster: 'mt1',
                channelAuthorization: expect.objectContaining({
                    endpoint: '/.netlify/functions/pusherAuth',
                    params: { playerId: 'player-123' },
                }),
            }),
        );
    });
});
