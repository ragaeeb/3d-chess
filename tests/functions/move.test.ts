import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { handler as moveHandler } from '../../netlify/functions/move';
import { __resetMemoryStore } from '../../netlify/functions/utils/gameStore';
import { setServerPusher } from '../../netlify/functions/utils/pusher';

type MockPusher = {
    trigger: ReturnType<typeof mock<(channel: string, event: string, payload?: unknown) => Promise<void>>>;
    authorizeChannel: ReturnType<typeof mock<(socketId: string, channel: string) => { auth: string }>>;
};

const createPusherMock = (): MockPusher => ({
    trigger: mock(async () => {}),
    authorizeChannel: mock(() => ({ auth: 'token' })),
});

const jsonEvent = (body: Record<string, unknown>, method: 'POST' | 'OPTIONS' = 'POST') => ({
    httpMethod: method,
    body: method === 'POST' ? JSON.stringify(body) : null,
    headers: { 'content-type': 'application/json' },
});

describe('move Netlify function', () => {
    beforeEach(() => {
        __resetMemoryStore();
        setServerPusher(createPusherMock());
    });

    test('handles CORS preflight', async () => {
        const response = await moveHandler(jsonEvent({}, 'OPTIONS'));
        expect(response.statusCode).toBe(200);
        expect(response.body).toBe('OK');
    });

    test('first player queues and waits', async () => {
        const response = await moveHandler(jsonEvent({ action: 'queue', playerId: 'p1' }));
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ status: 'waiting' });
    });

    test('second player matches and triggers notifications', async () => {
        const pusher = createPusherMock();
        setServerPusher(pusher);
        await moveHandler(jsonEvent({ action: 'queue', playerId: 'p1' }));
        const response = await moveHandler(jsonEvent({ action: 'queue', playerId: 'p2' }));
        const payload = JSON.parse(response.body);
        expect(payload.status).toBe('matched');
        expect(pusher.trigger).toHaveBeenCalled();
    });

    test('rejects move submissions without assignment', async () => {
        const response = await moveHandler(
            jsonEvent({ action: 'move', playerId: 'p1', move: { from: 'e2', to: 'e4' } }),
        );
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body)).toEqual({ error: 'Player is not assigned to a game' });
    });
});
