import type Pusher from 'pusher-js';
import type { Channel, PresenceChannel } from 'pusher-js';
import { useEffect, useRef } from 'react';
import { GAME_OVER, INIT_GAME, MOVE, OPPONENT_LEFT } from '@/types/socket';

type GameStartPayload = {
    status: 'matched' | 'already-playing';
    gameId: string;
    color: 'white' | 'black';
    fen: string;
};

type MoveBroadcastPayload = {
    playerId: string;
    move: { from: string; to: string; promotion?: string; captured?: string };
    fen: string;
    turn: string;
    check?: boolean;
};

type GameOverPayload = { winner?: 'white' | 'black' | null; reason?: string; fen?: string };

export function usePlayerChannel(
    pusherClient: Pusher | null,
    playerId: string | null,
    onMatchStart: (payload: GameStartPayload) => void,
    onError: () => void,
) {
    useEffect(() => {
        if (!pusherClient || !playerId) {
            return;
        }

        const channelName = `private-player-${playerId}`;
        const playerChannel = pusherClient.subscribe(channelName);

        playerChannel.bind(INIT_GAME, onMatchStart);

        playerChannel.bind('pusher:subscription_error', onError);

        return () => {
            playerChannel.unbind_all();
            pusherClient.unsubscribe(channelName);
        };
    }, [pusherClient, playerId, onMatchStart, onError]);
}

export function useGameChannel(
    pusherClient: Pusher | null,
    gameId: string,
    playerId: string | null,
    shouldSubscribe: boolean,
    callbacks: {
        onMove: (data: MoveBroadcastPayload) => void;
        onGameOver: (data: GameOverPayload) => void;
        onOpponentLeft: () => void;
        onOpponentDisconnected: () => void;
    },
) {
    const gameChannelRef = useRef<Channel | null>(null);
    const presenceChannelRef = useRef<PresenceChannel | null>(null);

    useEffect(() => {
        if (!pusherClient || !gameId || !playerId || !shouldSubscribe) {
            return;
        }

        // Cleanup previous subscriptions if any (though useEffect handles this with return)
        // But we want to be sure we are subscribing to the *new* gameId if it changes

        const privateChannel = pusherClient.subscribe(`private-game-${gameId}`);
        gameChannelRef.current = privateChannel;

        privateChannel.bind(MOVE, callbacks.onMove);
        privateChannel.bind(GAME_OVER, callbacks.onGameOver);
        privateChannel.bind(OPPONENT_LEFT, callbacks.onOpponentLeft);

        const presenceChannel = pusherClient.subscribe(`presence-game-${gameId}`) as PresenceChannel;
        presenceChannelRef.current = presenceChannel;

        presenceChannel.bind('pusher:member_removed', (member: { id: string }) => {
            if (member?.id && member.id !== playerId) {
                callbacks.onOpponentDisconnected();
            }
        });

        return () => {
            if (gameChannelRef.current) {
                gameChannelRef.current.unbind_all();
                pusherClient.unsubscribe(gameChannelRef.current.name);
                gameChannelRef.current = null;
            }
            if (presenceChannelRef.current) {
                presenceChannelRef.current.unbind_all();
                pusherClient.unsubscribe(presenceChannelRef.current.name);
                presenceChannelRef.current = null;
            }
        };
    }, [
        pusherClient,
        gameId,
        playerId,
        shouldSubscribe,
        callbacks.onMove,
        callbacks.onGameOver,
        callbacks.onOpponentLeft,
        callbacks.onOpponentDisconnected,
    ]);
}
