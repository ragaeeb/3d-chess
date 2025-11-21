const API_ENDPOINT = '/.netlify/functions/move';

export type JoinGameResponse = {
    role: 'spectator' | 'white' | 'black';
    color?: 'white' | 'black';
    status: 'waiting' | 'active';
    fen: string;
    gameId: string;
};

export async function joinGame(gameId: string, playerId: string): Promise<JoinGameResponse> {
    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', playerId, gameId }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to join game' }));
        throw new Error(error.error ?? 'Game not found');
    }

    return response.json();
}

export async function submitMove(playerId: string, move: { from: string; to: string }) {
    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', playerId, move }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to send move to server' }));
        throw new Error(error.error ?? 'Failed to send move to server');
    }
}

export function notifyLeave(gameId: string, playerId: string) {
    const payload = JSON.stringify({ action: 'leave', playerId, gameId });

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(API_ENDPOINT, blob);
        } catch (error) {
            console.error('Failed to send leave beacon', error);
        }
    } else {
        void fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
        }).catch((error) => {
            console.error('Failed to notify leave', error);
        });
    }
}
