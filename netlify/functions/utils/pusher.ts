import Pusher from 'pusher';

import { requiredEnv } from './env';

export type ServerPusher = Pick<Pusher, 'trigger' | 'authorizeChannel'>;

let cachedPusher: ServerPusher | null = null;

const createServerPusher = (): ServerPusher =>
    new Pusher({
        appId: requiredEnv('PUSHER_APP_ID'),
        key: requiredEnv('PUSHER_KEY'),
        secret: requiredEnv('PUSHER_SECRET'),
        cluster: requiredEnv('PUSHER_CLUSTER'),
        useTLS: true,
    });

export const getServerPusher = (): ServerPusher => {
    if (!cachedPusher) {
        cachedPusher = createServerPusher();
    }
    return cachedPusher;
};

export const setServerPusher = (instance: ServerPusher | null) => {
    cachedPusher = instance;
};
