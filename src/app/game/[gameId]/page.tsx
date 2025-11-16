'use client';

import { useParams } from 'next/navigation';
import { Canvas } from '@react-three/fiber';
import { Chess, type Square } from 'chess.js';
import type Pusher from 'pusher-js';
import type { Channel, PresenceChannel } from 'pusher-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import ChessBoard from '@/components/3d/chessBoard';
import GameStatusPanel from '@/components/GameStatusPanel';
import ShareGameLink from '@/components/ShareGameLink';
import { ensurePlayerId } from '@/lib/playerIdentity';
import { createPusherClient } from '@/lib/pusherClient';
import type { ChessMove, GameStatus, PlayerRole } from '@/types/game';
import { GAME_OVER, INIT_GAME, MOVE, OPPONENT_LEFT } from '@/types/socket';

type PresenceMember = { id: string; info?: { role?: string | null } };

const OPPONENT_DISCONNECTED_COPY = 'Your opponent disconnected.';

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
    const params = useParams();
    const gameId = params.gameId as string;
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [game] = useState(() => new Chess());
    const [board, setBoard] = useState(() => game.board());
    const [lastMove, setLastMove] = useState<ChessMove | null>(null);
    const [gameStatus, setGameStatus] = useState<GameStatus>('not-started');
    const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
    const [role, setRole] = useState<PlayerRole | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [bannerMessage, setBannerMessage] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
    const [showShareLink, setShowShareLink] = useState(false);
    const [canPlayAsOpponent, setCanPlayAsOpponent] = useState(false);
    const [isClaimingSeat, setIsClaimingSeat] = useState(false);

    const [pusherClient, setPusherClient] = useState<Pusher | null>(null);
    const gameChannelRef = useRef<Channel | null>(null);
    const presenceChannelRef = useRef<PresenceChannel | null>(null);
    const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const opponentDisconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isConnected = connectionState === 'connected';
    const isSpectator = role === 'spectator';

    useEffect(() => {
        setPlayerId(ensurePlayerId());
    }, []);

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
        setCanPlayAsOpponent(false);
        setIsClaimingSeat(false);
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

    const clearPendingOpponentDisconnect = useCallback(() => {
        if (opponentDisconnectTimeoutRef.current) {
            clearTimeout(opponentDisconnectTimeoutRef.current);
            opponentDisconnectTimeoutRef.current = null;
        }
        setMessage((current) => (current === OPPONENT_DISCONNECTED_COPY ? null : current));
    }, [setMessage]);

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
        clearPendingOpponentDisconnect();
    }, [clearPendingOpponentDisconnect, pusherClient]);

    const notifyLeave = useCallback(() => {
        if (!gameId || !playerId) {
            return;
        }

        const payload = JSON.stringify({ action: 'leave', playerId, gameId });

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
    }, [gameId, playerId]);

    const handleOpponentLeft = useCallback(() => {
        cleanupChannels();
        setGameStatus('not-started');
        setPlayerColor(null);
        setRole(null);
        setMessage('Your opponent has left the game. Create a new match to keep playing.');
        setShowShareLink(false);
        setCanPlayAsOpponent(false);
        setIsClaimingSeat(false);
        resetBoard();
    }, [cleanupChannels, resetBoard]);

    const handleGameOver = useCallback(
        (payload: GameOverPayload) => {
            cleanupChannels();

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
            setRole(null);
            setPlayerColor(null);
            setCanPlayAsOpponent(false);
            setIsClaimingSeat(false);
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
            const privateChannelName = `private-game-${nextGameId}`;
            if (gameChannelRef.current?.name === privateChannelName) {
                return;
            }

            cleanupChannels();

            const privateChannel = client.subscribe(privateChannelName);
            gameChannelRef.current = privateChannel;

            privateChannel.bind(MOVE, handleIncomingMove);
            privateChannel.bind(GAME_OVER, handleGameOver);
            privateChannel.bind(OPPONENT_LEFT, handleOpponentLeft);

            const presenceChannel = client.subscribe(`presence-game-${nextGameId}`) as PresenceChannel;
            presenceChannelRef.current = presenceChannel;

            presenceChannel.bind('pusher:member_removed', (member: PresenceMember) => {
                if (member?.id && member.id !== playerId && member?.info?.role !== 'spectator') {
                    if (opponentDisconnectTimeoutRef.current) {
                        clearTimeout(opponentDisconnectTimeoutRef.current);
                    }
                    opponentDisconnectTimeoutRef.current = setTimeout(() => {
                        setMessage(OPPONENT_DISCONNECTED_COPY);
                    }, 1200);
                }
            });

            presenceChannel.bind('pusher:member_added', (member: PresenceMember) => {
                if (member?.id && member.id !== playerId && member?.info?.role !== 'spectator') {
                    clearPendingOpponentDisconnect();
                }
            });
        },
        [
            cleanupChannels,
            clearPendingOpponentDisconnect,
            handleGameOver,
            handleIncomingMove,
            handleOpponentLeft,
            playerId,
            setMessage,
        ],
    );

    const startMatch = useCallback(
        (payload: GameStartPayload) => {
            if (payload.gameId !== gameId) {
                return;
            }

            const { color, fen } = payload;
            setRole(color);
            setPlayerColor(color);
            setGameStatus('started');
            setMessage(null);
            setShowShareLink(false);
            setCanPlayAsOpponent(false);
            setIsClaimingSeat(false);
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
                subscribeToGameChannels(pusherClient, payload.gameId);
            }
        },
        [clearBanner, game, gameId, pusherClient, resetBoard, subscribeToGameChannels],
    );

    useEffect(() => {
        if (!playerId) {
            return;
        }

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
        if (!pusherClient || !playerId) {
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
        if (!gameId || !pusherClient || !playerId) {
            return;
        }

        let cancelled = false;

        const joinGame = async () => {
            try {
                const response = await fetch('/.netlify/functions/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'join', playerId, gameId }),
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: 'Failed to join game' }));
                    if (!cancelled) {
                        setMessage(error.error ?? 'Game not found');
                    }
                    return;
                }

                const result = await response.json();
                if (cancelled) {
                    return;
                }

                if (result.role === 'spectator') {
                    setRole('spectator');
                    const canClaim = Boolean(result.canPlayAsOpponent);
                    setCanPlayAsOpponent(canClaim);
                    if (canClaim && result.status === 'waiting') {
                        setGameStatus('waiting-opponent');
                        setMessage('Click "Play as Opponent" to join the match.');
                    } else if (result.status === 'waiting') {
                        setGameStatus('waiting-opponent');
                        setMessage('Waiting for the host to start the match.');
                    } else {
                        setGameStatus('started');
                        setMessage('You are spectating this game');
                    }
                    setShowShareLink(false);
                } else if (result.color) {
                    setPlayerColor(result.color);
                    setRole(result.color);
                    setCanPlayAsOpponent(false);

                    if (result.status === 'waiting') {
                        setGameStatus('waiting-opponent');
                        setMessage('Waiting for opponent to join...');
                        setShowShareLink(true);
                    } else if (result.status === 'active') {
                        setGameStatus('started');
                        setMessage(null);
                        setShowShareLink(false);
                    }
                }

                try {
                    game.load(result.fen);
                    setBoard(game.board());
                } catch (error) {
                    console.error('Failed to load game state', error);
                }

                subscribeToGameChannels(pusherClient, gameId);
            } catch (error) {
                console.error('Failed to join game', error);
                if (!cancelled) {
                    setMessage('Failed to join game. Please try again.');
                }
            }
        };

        joinGame();

        return () => {
            cancelled = true;
        };
    }, [game, gameId, playerId, pusherClient, subscribeToGameChannels]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            notifyLeave();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            notifyLeave();
        };
    }, [notifyLeave]);

    useEffect(() => () => cleanupChannels(), [cleanupChannels]);

    const handleClaimOpponentSeat = useCallback(async () => {
        if (!playerId || !gameId || isClaimingSeat) {
            return;
        }

        setIsClaimingSeat(true);
        try {
            const response = await fetch('/.netlify/functions/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'claim', playerId, gameId }),
            });

            const result = await response.json().catch(() => ({ error: 'Unable to claim opponent seat' }));
            if (!response.ok) {
                setMessage(result.error ?? 'Unable to claim opponent seat');
                return;
            }

            if (result.color === 'black') {
                try {
                    game.load(result.fen);
                } catch (error) {
                    console.error('Failed to sync game after claiming seat', error);
                }
                setBoard(game.board());
                setPlayerColor('black');
                setRole('black');
                setGameStatus('started');
                setMessage(null);
                setLastMove(null);
                setCanPlayAsOpponent(false);
                setShowShareLink(false);
                updateBannerFromGame();
            }
        } catch (error) {
            console.error('Failed to claim opponent seat', error);
            setMessage('Failed to join as opponent. Please try again.');
        } finally {
            setIsClaimingSeat(false);
        }
    }, [game, gameId, isClaimingSeat, playerId, updateBannerFromGame]);

    const handleLocalMove = useCallback(
        (move: { from: string; to: string }) => {
            if (isSpectator) {
                setMessage('You are spectating this game');
                return;
            }

            if (gameStatus !== 'started' || !playerColor || !playerId) {
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
                body: JSON.stringify({ action: 'move', playerId, move }),
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
        [game, gameStatus, isSpectator, playerColor, playerId, updateBannerFromGame],
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

            {showShareLink && gameStatus === 'waiting-opponent' && (
                <ShareGameLink gameId={gameId} onClose={() => setShowShareLink(false)} />
            )}

            <GameStatusPanel
                isConnected={isConnected}
                message={message}
                gameStatus={gameStatus}
                playerColor={playerColor}
                role={role}
                turn={turn}
                canPlayAsOpponent={canPlayAsOpponent}
                onClaimSeat={canPlayAsOpponent ? handleClaimOpponentSeat : undefined}
                isClaimingSeat={isClaimingSeat}
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
                    isSpectator={isSpectator}
                />
            </Canvas>
        </div>
    );
};

export default GamePage;
