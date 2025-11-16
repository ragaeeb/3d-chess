import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { handler } from '../move';
import { __resetMemoryStore } from '../utils/gameStore';
import { setServerPusher } from '../utils/pusher';

type JsonEventMethod = 'POST' | 'OPTIONS';

const jsonEvent = (body: Record<string, unknown>, method: JsonEventMethod = 'POST') => ({
    httpMethod: method,
    body: method === 'POST' ? JSON.stringify(body) : null,
    headers: { 'content-type': 'application/json' },
});

const createPusherMock = () => ({
    trigger: mock(async () => {}),
    authorizeChannel: mock(() => ({ auth: 'ok' })),
});

describe('move handler', () => {
    beforeEach(() => {
        __resetMemoryStore();
        setServerPusher(createPusherMock());
    });

    test('handles CORS preflight', async () => {
        const response = await handler(jsonEvent({}, 'OPTIONS'));
        expect(response.statusCode).toBe(200);
        expect(response.body).toBe('OK');
    });

    test('creates new game with unique ID', async () => {
        const event = jsonEvent({ action: 'create', playerId: 'player1' });
        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.gameId).toBeDefined();
        expect(body.color).toBe('white');
        expect(body.status).toBe('waiting');
    });

    test('joins existing game as black', async () => {
        const createResponse = await handler(jsonEvent({ action: 'create', playerId: 'white-player' }));
        const { gameId } = JSON.parse(createResponse.body);

        const joinResponse = await handler(jsonEvent({ action: 'join', playerId: 'black-player', gameId }));
        expect(joinResponse.statusCode).toBe(200);

        const payload = JSON.parse(joinResponse.body);
        expect(payload.color).toBe('black');
        expect(payload.status).toBe('active');
    });

    test('joins as spectator when game is full', async () => {
        const createResponse = await handler(jsonEvent({ action: 'create', playerId: 'white-player' }));
        const { gameId } = JSON.parse(createResponse.body);

        await handler(jsonEvent({ action: 'join', playerId: 'black-player', gameId }));

        const spectatorResponse = await handler(jsonEvent({ action: 'join', playerId: 'spectator', gameId }));
        expect(spectatorResponse.statusCode).toBe(200);

        const payload = JSON.parse(spectatorResponse.body);
        expect(payload.role).toBe('spectator');
        expect(payload.status).toBe('active');
    });

    test('returns 404 for non-existent game', async () => {
        const response = await handler(jsonEvent({ action: 'join', playerId: 'player-one', gameId: 'missing' }));
        expect(response.statusCode).toBe(404);
    });
});
