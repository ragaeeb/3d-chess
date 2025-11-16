import Pusher from 'pusher-js';

export const createPusherClient = (playerId: string) => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key) {
        throw new Error('Missing NEXT_PUBLIC_PUSHER_KEY environment variable');
    }

    if (!cluster) {
        throw new Error('Missing NEXT_PUBLIC_PUSHER_CLUSTER environment variable');
    }

    if (!playerId || !playerId.trim()) {
        throw new Error('playerId is required to initialise Pusher');
    }

    return new Pusher(key, {
        cluster,
        forceTLS: true,
        channelAuthorization: { endpoint: '/.netlify/functions/pusherAuth', transport: 'ajax', params: { playerId } },
    });
};
