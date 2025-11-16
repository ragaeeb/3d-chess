import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as moveRoute from './move/route';
import * as authRoute from './pusherAuth/route';
import { __resetMemoryStore } from '../../../netlify/functions/utils/gameStore';
import { setServerPusher } from '../../../netlify/functions/utils/pusher';

const createPusherMock = () => ({ trigger: mock(async () => {}), authorizeChannel: mock(() => ({ auth: 'ok' })) });

describe('Next.js Netlify bridges', () => {
    beforeEach(() => {
        __resetMemoryStore();
        setServerPusher(createPusherMock());
    });

    test('move route proxies JSON payloads to the Netlify handler', async () => {
        const request = new Request('http://localhost/.netlify/functions/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'queue', playerId: 'route-player' }),
        });
        const response = await moveRoute.POST(request);
        expect(response.status).toBe(200);
        expect(await response.text()).toContain('status');
    });

    test('auth route handles OPTIONS preflight', async () => {
        const request = new Request('http://localhost/.netlify/functions/pusherAuth', { method: 'OPTIONS' });
        const response = await authRoute.OPTIONS(request);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('OK');
    });
});
