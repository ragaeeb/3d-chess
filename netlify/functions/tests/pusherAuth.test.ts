import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { handler as authHandler } from '../pusherAuth';
import { __resetMemoryStore, saveGameRecord, setAssignment } from '../utils/gameStore';
import type { GameRecord } from '../utils/gameStore';
import { setServerPusher } from '../utils/pusher';

const jsonEvent = (body: string, headers: Record<string, string> = { 'content-type': 'application/json' }) => ({
    httpMethod: 'POST',
    headers,
    body,
});

let authorizeChannel: ReturnType<typeof mock<(socketId: string, channel: string, data?: unknown) => { auth: string }>>;

describe('pusherAuth Netlify function', () => {
    beforeEach(() => {
        __resetMemoryStore();
        authorizeChannel = mock((socketId: string, channel: string, data?: unknown) => ({ auth: 'ok', data }));
        setServerPusher({ trigger: mock(async () => {}), authorizeChannel });
    });

    test('rejects unknown players', async () => {
        const response = await authHandler(
            jsonEvent(JSON.stringify({ socket_id: '1', channel_name: 'private-game-game', playerId: 'missing' })),
        );
        expect(response.statusCode).toBe(403);
        expect(JSON.parse(response.body)).toEqual({ error: 'Player is not part of this game' });
    });

    test('authorizes assigned players for private channels', async () => {
        await setAssignment('player-a', { gameId: 'game-1', color: 'white' });
        const response = await authHandler(
            jsonEvent(JSON.stringify({ socket_id: '1', channel_name: 'private-game-game-1', playerId: 'player-a' })),
        );
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ auth: 'ok' });
    });
    test('allows spectators to authorize', async () => {
        const record: GameRecord = {
            id: 'game-1',
            fen: 'start',
            players: { white: 'white-player', black: null },
            spectators: ['spectator-a'],
            lastUpdated: Date.now(),
            status: 'waiting',
        };
        await saveGameRecord(record);

        const response = await authHandler(
            jsonEvent(JSON.stringify({ socket_id: '1', channel_name: 'private-game-game-1', playerId: 'spectator-a' })),
        );
        expect(response.statusCode).toBe(200);
    });

    test('passes role metadata for presence channels', async () => {
        await setAssignment('player-a', { gameId: 'game-1', color: 'white' });
        const response = await authHandler(
            jsonEvent(JSON.stringify({ socket_id: '1', channel_name: 'presence-game-game-1', playerId: 'player-a' })),
        );
        expect(response.statusCode).toBe(200);
        const lastCall = authorizeChannel.mock.calls.at(-1);
        expect(lastCall?.[2]).toEqual(
            expect.objectContaining({
                user_id: 'player-a',
                user_info: expect.objectContaining({ role: 'white' }),
            }),
        );
    });
});
