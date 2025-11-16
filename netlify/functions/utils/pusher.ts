import { createHash, createHmac } from 'node:crypto';

import { requiredEnv } from './env';

type TriggerParams = { socket_id?: string; info?: string };

export type ServerPusher = {
    trigger: (channels: string | string[], event: string, data: unknown, params?: TriggerParams) => Promise<void>;
    authorizeChannel: (socketId: string, channel: string, presenceData?: Record<string, unknown>) => {
        auth: string;
        channel_data?: string;
    };
};

const serializePayload = (payload: unknown) => {
    if (typeof payload === 'string') {
        return payload;
    }
    if (payload === undefined) {
        return '';
    }
    return JSON.stringify(payload);
};

const createSignature = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex');

const createServerPusher = (): ServerPusher => {
    const appId = requiredEnv('PUSHER_APP_ID');
    const key = requiredEnv('PUSHER_KEY');
    const secret = requiredEnv('PUSHER_SECRET');
    const cluster = requiredEnv('PUSHER_CLUSTER');
    const host = `api-${cluster}.pusher.com`;

    return {
        authorizeChannel: (socketId, channel, presenceData) => {
            const channelData = presenceData ? JSON.stringify(presenceData) : undefined;
            const stringToSign = channelData ? `${socketId}:${channel}:${channelData}` : `${socketId}:${channel}`;
            const signature = createSignature(secret, stringToSign);
            return channelData
                ? { auth: `${key}:${signature}`, channel_data: channelData }
                : { auth: `${key}:${signature}` };
        },
        trigger: async (channels, event, data, params) => {
            const channelList = Array.isArray(channels) ? channels : [channels];
            const payload = serializePayload(data);
            const body = JSON.stringify({
                name: event,
                channels: channelList,
                data: payload,
                ...(params?.socket_id ? { socket_id: params.socket_id } : {}),
                ...(params?.info ? { info: params.info } : {}),
            });

            const path = `/apps/${appId}/events`;
            const bodyMd5 = createHash('md5').update(body).digest('hex');
            const authTimestamp = Math.floor(Date.now() / 1000).toString();
            const query = new URLSearchParams({
                auth_key: key,
                auth_timestamp: authTimestamp,
                auth_version: '1.0',
                body_md5: bodyMd5,
            });
            const stringToSign = ['POST', path, query.toString()].join('\n');
            query.append('auth_signature', createSignature(secret, stringToSign));

            const response = await fetch(`https://${host}${path}?${query.toString()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new Error(`Failed to trigger Pusher event: ${response.status} ${errorBody}`);
            }
        },
    } satisfies ServerPusher;
};

let cachedPusher: ServerPusher | null = null;

export const getServerPusher = (): ServerPusher => {
    if (!cachedPusher) {
        cachedPusher = createServerPusher();
    }
    return cachedPusher;
};

export const setServerPusher = (instance: ServerPusher | null) => {
    cachedPusher = instance;
};
