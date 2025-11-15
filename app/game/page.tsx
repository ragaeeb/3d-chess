'use client';

import { Canvas } from '@react-three/fiber';
import { Chess, type Square } from 'chess.js';
import type Pusher from 'pusher-js';
import type { Channel, PresenceChannel } from 'pusher-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import ChessBoard from '@/components/3d/chessBoard';
import GameStatusPanel from '@/components/GameStatusPanel';
import { createPusherClient } from '@/lib/pusherClient';
import type { ChessMove, GameStatus } from '@/types/game';
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

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

const GamePage: React.FC = () => {
    const [playerId] = useState(() => crypto.randomUUID());
    const [game] = useState(() => new Chess());
    const [board, setBoard] = useState(() => game.board());
    const [lastMove, setLastMove] = useState<ChessMove | null>(null);
    const [gameStatus, setGameStatus] = useState<GameStatus>('not-started');
    const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [bannerMessage, setBannerMessage] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
    const [gameId, setGameId] = useState<string | null>(null);

    const [pusherClient, setPusherClient] = useState<Pusher | null>(null);
    const gameChannelRef = useRef<Channel | null>(null);
    const presenceChannelRef = useRef<PresenceChannel | null>(null);
    const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const waitingRef = useRef(false);

    const isConnected = connectionState === 'connected';

    const clearBanner = useCallback(() => {
        if (bannerTimeoutRef.current) {
            clearTimeout(bannerTimeoutRef.current);
            bannerTimeoutRef.current = null;
        }
        setBannerMessage(null);
    }, []);

    const resetBoard = useCallback(() => {
        game.reset();
        setBoard(game.board());
        setLastMove(null);
        clearBanner();
    }, [game, clearBanner]);

    const updateBannerFromGame = useCallback(() => {
        if (bannerTimeoutRef.current) {
            clearTimeout(bannerTimeoutRef.current);
            bannerTimeoutRef.current = null;
        }

        if (game.isCheckmate()) {
            setBannerMessage('Checkmate');
            return;
        }

        if (game.isCheck()) {
            setBannerMessage('Check');
            bannerTimeoutRef.current = setTimeout(() => {
                setBannerMessage(null);
                bannerTimeoutRef.current = null;
            }, 2000);
            return;
        }

        setBannerMessage(null);
    }, [game]);

    const cleanupChannels = useCallback(() => {
        if (pusherClient && gameChannelRef.current) {
            gameChannelRef.current.unbind_all();
            pusherClient.unsubscribe(gameChannelRef.current.name);
            gameChannelRef.current = null;
        }

        if (pusherClient && presenceChannelRef.current) {
            presenceChannelRef.current.unbind_all();
            pusherClient.unsubscribe(presenceChannelRef.current.name);
            presenceChannelRef.current = null;
        }
    }, [pusherClient]);

    const notifyLeave = useCallback(() => {
        if (!waitingRef.current && !gameId) {
            return;
        }

        const payload = JSON.stringify({ action: 'leave', playerId });

        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            try {
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon('/.netlify/functions/move', blob);
            } catch (error) {
                console.error('Failed to send leave beacon', error);
            }
        } else {
            void fetch('/.netlify/functions/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true,
            }).catch((error) => {
                console.error('Failed to notify leave', error);
            });
        }

        waitingRef.current = false;
    }, [gameId, playerId]);

    const handleOpponentLeft = useCallback(() => {
        cleanupChannels();
        setGameStatus('not-started');
        setPlayerColor(null);
        setMessage('Your opponent has left the game. Queue again to find a new match.');
        waitingRef.current = false;
        setGameId(null);
        resetBoard();
    }, [cleanupChannels, resetBoard]);

    const handleGameOver = useCallback(
        (payload: GameOverPayload) => {
            cleanupChannels();
            waitingRef.current = false;
            setGameId(null);

            if (payload.fen) {
                try {
                    game.load(payload.fen);
                    setBoard(game.board());
                } catch (error) {
                    console.error('Failed to load final position', error);
                }
            }

            if (payload.winner) {
                setBannerMessage(`Game Over - ${payload.winner} wins`);
                setMessage(null);
            } else {
                setBannerMessage('Game Over');
            }

            setGameStatus('not-started');
            setPlayerColor(null);
        },
        [cleanupChannels, game],
    );

    const handleIncomingMove = useCallback(
        (data: MoveBroadcastPayload) => {
            try {
                game.load(data.fen);
                setBoard(game.board());
                setLastMove({
                    from: data.move.from as Square,
                    to: data.move.to as Square,
                    captured: data.move.captured,
                });
                updateBannerFromGame();
                setMessage(null);
            } catch (error) {
                console.error('Failed to process move payload', error);
            }
        },
        [game, updateBannerFromGame],
    );

    const subscribeToGameChannels = useCallback(
        (client: Pusher, nextGameId: string) => {
            cleanupChannels();

            const privateChannel = client.subscribe(`private-game-${nextGameId}`);
            gameChannelRef.current = privateChannel;

            privateChannel.bind(MOVE, handleIncomingMove);
            privateChannel.bind(GAME_OVER, handleGameOver);
            privateChannel.bind(OPPONENT_LEFT, handleOpponentLeft);

            const presenceChannel = client.subscribe(`presence-game-${nextGameId}`) as PresenceChannel;
            presenceChannelRef.current = presenceChannel;

            presenceChannel.bind('pusher:member_removed', (member: { id: string }) => {
                if (member?.id && member.id !== playerId) {
                    setMessage('Your opponent disconnected.');
                }
            });
        },
        [cleanupChannels, handleGameOver, handleIncomingMove, handleOpponentLeft, playerId],
    );

    const startMatch = useCallback(
        (payload: GameStartPayload) => {
            const { gameId: nextGameId, color, fen } = payload;
            waitingRef.current = false;
            setGameId(nextGameId);
            setPlayerColor(color);
            setGameStatus('started');
            setMessage(null);
            clearBanner();

            try {
                game.load(fen);
                setBoard(game.board());
            } catch (error) {
                console.error('Failed to load game state', error);
                resetBoard();
            }
            setLastMove(null);
            if (pusherClient) {
                subscribeToGameChannels(pusherClient, nextGameId);
            }
        },
        [clearBanner, game, pusherClient, resetBoard, subscribeToGameChannels],
    );

    useEffect(() => {
        let client: Pusher | null = null;

        try {
            client = createPusherClient(playerId);
            setPusherClient(client);
        } catch (error) {
            console.error('Failed to create Pusher client', error);
            setMessage('Unable to initialise realtime connection.');
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

    useEffect(() => {
        if (!pusherClient) {
            return;
        }

        const channelName = `private-player-${playerId}`;
        const playerChannel = pusherClient.subscribe(channelName);

        playerChannel.bind(INIT_GAME, (payload: GameStartPayload) => {
            startMatch(payload);
        });

        playerChannel.bind('pusher:subscription_error', () => {
            setMessage('Unable to join private channel. Check your Pusher credentials.');
            setConnectionState('disconnected');
        });

        return () => {
            playerChannel.unbind_all();
            pusherClient.unsubscribe(channelName);
        };
    }, [playerId, pusherClient, startMatch]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            notifyLeave();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            handleBeforeUnload();
        };
    }, [notifyLeave]);

    useEffect(
        () => () => {
            notifyLeave();
        },
        [notifyLeave],
    );

    const handleStartGame = useCallback(async () => {
        if (!pusherClient || !isConnected) {
            setMessage('Unable to start game while disconnected.');
            return;
        }

        waitingRef.current = true;
        cleanupChannels();
        resetBoard();
        setPlayerColor(null);
        setGameStatus('waiting-opponent');
        setMessage('Waiting for an opponent...');

        try {
            const response = await fetch('/.netlify/functions/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'queue', playerId }),
            });

            const result = await response.json().catch(() => ({ error: 'Failed to join queue' }));

            if (!response.ok) {
                waitingRef.current = false;
                setMessage(result.error ?? 'Failed to join queue');
                setGameStatus('not-started');
                return;
            }

            if (result.status === 'waiting') {
                return;
            }

            if (result.status === 'matched' || result.status === 'already-playing') {
                startMatch(result as GameStartPayload);
            }
        } catch (error) {
            waitingRef.current = false;
            console.error('Failed to join match queue', error);
            setMessage('Unable to join the queue. Please try again.');
            setGameStatus('not-started');
        }
    }, [cleanupChannels, isConnected, playerId, pusherClient, resetBoard, startMatch]);

    const handleLocalMove = useCallback(
        (move: { from: string; to: string }) => {
            if (gameStatus !== 'started' || !playerColor || !gameId) {
                return;
            }

            const expectedTurn = playerColor === 'white' ? 'w' : 'b';
            if (game.turn() !== expectedTurn) {
                setMessage("It isn't your turn yet.");
                return;
            }

            const availableMoves = game.moves({ square: move.from as Square, verbose: true });
            const isLegalDestination = availableMoves.some((m) => m.to === move.to);
            if (!isLegalDestination) {
                setMessage('Illegal move');
                return;
            }

            const targetSquare = game.get(move.to as Square);
            const captured = targetSquare ? targetSquare.type : undefined;

            const result = game.move({ from: move.from as Square, to: move.to as Square, promotion: 'q' });

            if (!result) {
                setMessage('Illegal move');
                return;
            }

            setLastMove({ from: move.from as Square, to: move.to as Square, captured });
            setBoard(game.board());
            setMessage(null);
            updateBannerFromGame();

            fetch('/.netlify/functions/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'move', playerId, move, gameId }),
            })
                .then(async (response) => {
                    if (response.ok) {
                        return;
                    }
                    const error = await response.json().catch(() => ({ error: 'Failed to send move to server' }));
                    setMessage(error.error ?? 'Failed to send move to server');
                    game.undo();
                    setBoard(game.board());
                    setLastMove(null);
                    updateBannerFromGame();
                })
                .catch((error) => {
                    console.error('Failed to send move', error);
                    setMessage('Failed to send move to server');
                    game.undo();
                    setBoard(game.board());
                    setLastMove(null);
                    updateBannerFromGame();
                });
        },
        [game, gameId, gameStatus, playerColor, playerId, updateBannerFromGame],
    );

    const getLegalMoves = useCallback(
        (square: Square): Square[] => {
            const moves = game.moves({ square, verbose: true });
            return moves.map((m) => m.to as Square);
        },
        [game],
    );

    const turn = game.turn();

    return (
        <div className="relative h-screen">
            {bannerMessage && (
                <div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/3 left-1/2 z-50 flex h-20 w-full items-center justify-center border border-white bg-white/10 font-bold text-2xl text-white shadow-2xl backdrop-blur-sm">
                    {bannerMessage}
                </div>
            )}

            <GameStatusPanel
                isConnected={isConnected}
                message={message}
                gameStatus={gameStatus}
                playerColor={playerColor}
                handleStartGame={handleStartGame}
                turn={turn}
            />

            <Canvas
                shadows
                className="bg-gradient-to-b from-black to-zinc-700"
                camera={{ position: [10, 10, 10], fov: 20 }}
                style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}
            >
                <ChessBoard
                    board={board}
                    onMove={handleLocalMove}
                    getLegalMoves={getLegalMoves}
                    gameStatus={gameStatus}
                    playerColor={playerColor}
                    lastMove={lastMove}
                />
            </Canvas>
        </div>
    );
};

export default GamePage;
