import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { handler as authHandler } from '../../netlify/functions/pusherAuth';
import { __resetMemoryStore, setAssignment } from '../../netlify/functions/utils/gameStore';
import { setServerPusher } from '../../netlify/functions/utils/pusher';

const jsonEvent = (body: string, headers: Record<string, string> = { 'content-type': 'application/json' }) => ({
    httpMethod: 'POST',
    headers,
    body,
});

describe('pusherAuth Netlify function', () => {
    beforeEach(() => {
        __resetMemoryStore();
        setServerPusher({ trigger: mock(async () => {}), authorizeChannel: mock(() => ({ auth: 'ok' })) });
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
});
