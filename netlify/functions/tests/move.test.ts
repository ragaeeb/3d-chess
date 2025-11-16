import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { Chess } from 'chess.js';

import { handler } from '../move';
import { __resetMemoryStore, getGameRecord } from '../utils/gameStore';
import { setServerPusher } from '../utils/pusher';
import { INIT_GAME, MOVE } from '@/types/socket';

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

const setupMatch = async (whiteId = 'white-player', blackId = 'black-player', autoClaimBlack = true) => {
    const createResponse = await handler(jsonEvent({ action: 'create', playerId: whiteId }));
    const { gameId } = JSON.parse(createResponse.body);

    if (autoClaimBlack) {
        const joinResponse = await handler(jsonEvent({ action: 'join', playerId: blackId, gameId }));
        expect(joinResponse.statusCode).toBe(200);
        const joinPayload = JSON.parse(joinResponse.body);
        expect(joinPayload.role).toBe('spectator');
        expect(joinPayload.canPlayAsOpponent).toBe(true);

        const claimResponse = await handler(jsonEvent({ action: 'claim', playerId: blackId, gameId }));
        expect(claimResponse.statusCode).toBe(200);
    }

    return { gameId, whiteId, blackId };
};

describe('move handler', () => {
    let pusherMock: ReturnType<typeof createPusherMock>;

    beforeEach(() => {
        __resetMemoryStore();
        pusherMock = createPusherMock();
        setServerPusher(pusherMock);
    });

    it('should handle CORS preflight', async () => {
        const response = await handler(jsonEvent({}, 'OPTIONS'));
        expect(response.statusCode).toBe(200);
        expect(response.body).toBe('OK');
    });

    it('should create new game with unique ID', async () => {
        const event = jsonEvent({ action: 'create', playerId: 'player1' });
        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.gameId).toBeDefined();
        expect(body.color).toBe('white');
        expect(body.status).toBe('waiting');
    });

    it('should require claiming the opponent seat before the match starts', async () => {
        const { gameId, whiteId } = await setupMatch('white-join', 'black-join', false);
        const joinResponse = await handler(jsonEvent({ action: 'join', playerId: 'black-join', gameId }));
        expect(joinResponse.statusCode).toBe(200);

        const joinPayload = JSON.parse(joinResponse.body);
        expect(joinPayload.role).toBe('spectator');
        expect(joinPayload.canPlayAsOpponent).toBe(true);

        const claimResponse = await handler(jsonEvent({ action: 'claim', playerId: 'black-join', gameId }));
        expect(claimResponse.statusCode).toBe(200);

        const payload = JSON.parse(claimResponse.body);
        expect(payload.color).toBe('black');
        expect(payload.status).toBe('active');

        const lastCall = pusherMock.trigger.mock.calls.at(-1);
        expect(lastCall?.[0]).toBe(`private-player-${whiteId}`);
        expect(lastCall?.[1]).toBe(INIT_GAME);
    });

    it('should join as spectator when game is full', async () => {
        const { gameId } = await setupMatch('white-spectator', 'black-spectator');

        const spectatorResponse = await handler(jsonEvent({ action: 'join', playerId: 'spectator', gameId }));
        expect(spectatorResponse.statusCode).toBe(200);

        const payload = JSON.parse(spectatorResponse.body);
        expect(payload.role).toBe('spectator');
        expect(payload.status).toBe('active');
    });

    it('should return 404 for non-existent game', async () => {
        const response = await handler(jsonEvent({ action: 'join', playerId: 'player-one', gameId: 'missing' }));
        expect(response.statusCode).toBe(404);
    });

    it('should allow legal moves and update board state', async () => {
        const { gameId, whiteId } = await setupMatch('white-move', 'black-move');

        const moveResponse = await handler(
            jsonEvent({ action: 'move', playerId: whiteId, move: { from: 'e2', to: 'e4' } }),
        );
        expect(moveResponse.statusCode).toBe(200);

        const record = await getGameRecord(gameId);
        expect(record).not.toBeNull();
        const chess = new Chess(record?.fen);
        const piece = chess.get('e4');
        expect(piece?.type).toBe('p');
        expect(piece?.color).toBe('w');
        expect(chess.turn()).toBe('b');

        const lastCall = pusherMock.trigger.mock.calls.at(-1);
        expect(lastCall?.[0]).toBe(`private-game-${gameId}`);
        expect(lastCall?.[1]).toBe(MOVE);
    });

    it('should reject illegal moves without changing state', async () => {
        const { gameId, whiteId } = await setupMatch('white-illegal', 'black-illegal');
        const initialGame = await getGameRecord(gameId);
        const initialFen = initialGame?.fen;
        const initialTriggerCount = pusherMock.trigger.mock.calls.length;

        const moveResponse = await handler(
            jsonEvent({ action: 'move', playerId: whiteId, move: { from: 'e2', to: 'e5' } }),
        );
        expect(moveResponse.statusCode).toBe(400);
        expect(JSON.parse(moveResponse.body)).toEqual({ error: 'Illegal move' });

        const record = await getGameRecord(gameId);
        expect(record?.fen).toBe(initialFen);
        expect(pusherMock.trigger.mock.calls.length).toBe(initialTriggerCount);
    });

    it('should prevent moves when it is not the player turn', async () => {
        const { gameId, blackId } = await setupMatch('white-turn', 'black-turn');
        const initialRecord = await getGameRecord(gameId);
        const initialFen = initialRecord?.fen;

        const moveResponse = await handler(
            jsonEvent({ action: 'move', playerId: blackId, move: { from: 'e7', to: 'e5' } }),
        );
        expect(moveResponse.statusCode).toBe(400);
        expect(JSON.parse(moveResponse.body)).toEqual({ error: 'Not your turn' });

        const record = await getGameRecord(gameId);
        expect(record?.fen).toBe(initialFen);
    });
});
