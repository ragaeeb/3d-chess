import type Pusher from 'pusher-js';
import { useEffect, useState } from 'react';
import { createPusherClient } from '@/lib/pusherClient';

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

export function usePusherConnection(playerId: string | null) {
    const [pusherClient, setPusherClient] = useState<Pusher | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!playerId) {
            return;
        }

        let client: Pusher | null = null;

        try {
            client = createPusherClient(playerId);
            setPusherClient(client);
        } catch (err) {
            console.error('Failed to create Pusher client', err);
            setError('Unable to initialise realtime connection.');
            setConnectionState('disconnected');
            return () => {};
        }

        const handleConnected = () => setConnectionState('connected');
        const handleConnecting = () => setConnectionState('connecting');
        const handleDisconnected = () => setConnectionState('disconnected');

        client.connection.bind('connected', handleConnected);
        client.connection.bind('connecting', handleConnecting);
        client.connection.bind('disconnected', handleDisconnected);
        client.connection.bind('unavailable', handleDisconnected);

        return () => {
            client?.disconnect();
            setConnectionState('disconnected');
        };
    }, [playerId]);

    return { pusherClient, connectionState, error };
}
