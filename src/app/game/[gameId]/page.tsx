'use client';

import { Canvas } from '@react-three/fiber';
import type { Square } from 'chess.js';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraAnimator } from '@/components/3d/CameraAnimator';
import ChessBoard from '@/components/3d/chessBoard';
import GameStatusPanel from '@/components/GameStatusPanel';
import ShareGameLink from '@/components/ShareGameLink';
import { useChessGame } from '@/hooks/useChessGame';
import { useGameChannel, usePlayerChannel } from '@/hooks/useGameSubscription';
import { usePusherConnection } from '@/hooks/usePusherConnection';
import { type JoinGameResponse, joinGame, notifyLeave, submitMove } from '@/lib/gameApi';
import { ensurePlayerId } from '@/lib/playerIdentity';
import type { GameStatus, PlayerRole } from '@/types/game';

const GamePage: React.FC = () => {
    const params = useParams();
    const gameId = params.gameId as string;
    const [playerId, setPlayerId] = useState<string | null>(null);

    // Game State
    const {
        board,
        lastMove,
        setLastMove,
        turn,
        isCheck,
        isCheckmate,
        resetGame,
        loadFen,
        makeMove,
        undoMove,
        getLegalMoves,
    } = useChessGame();

    // UI State
    const [gameStatus, setGameStatus] = useState<GameStatus>('not-started');
    const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
    const [role, setRole] = useState<PlayerRole | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [bannerMessage, setBannerMessage] = useState<string | null>(null);
    const [showShareLink, setShowShareLink] = useState(false);
    const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [cameraLocked, setCameraLocked] = useState(false);

    const isSpectator = role === 'spectator';

    // Pusher Connection
    const { pusherClient, connectionState } = usePusherConnection(playerId);
    const isConnected = connectionState === 'connected';

    useEffect(() => {
        setPlayerId(ensurePlayerId());
    }, []);

    // Banner Logic
    const clearBanner = useCallback(() => {
        if (bannerTimeoutRef.current) {
            clearTimeout(bannerTimeoutRef.current);
            bannerTimeoutRef.current = null;
        }
        setBannerMessage(null);
    }, []);

    const updateBannerFromGame = useCallback(() => {
        clearBanner();

        if (isCheckmate) {
            setBannerMessage('Checkmate');
            return;
        }

        if (isCheck) {
            setBannerMessage('Check');
            bannerTimeoutRef.current = setTimeout(() => {
                setBannerMessage(null);
                bannerTimeoutRef.current = null;
            }, 2000);
            return;
        }
    }, [isCheck, isCheckmate, clearBanner]);

    // Effect to update banner when game state changes (check/checkmate)
    useEffect(() => {
        if (gameStatus === 'started') {
            updateBannerFromGame();
        }
    }, [gameStatus, updateBannerFromGame]);

    const handleReset = useCallback(() => {
        resetGame();
        clearBanner();
    }, [resetGame, clearBanner]);

    const handleOpponentLeft = useCallback(() => {
        setGameStatus('not-started');
        setPlayerColor(null);
        setRole(null);
        setMessage('Your opponent has left the game. Create a new match to keep playing.');
        setShowShareLink(false);
        handleReset();
    }, [handleReset]);

    const handleGameOver = useCallback(
        (payload: { winner?: 'white' | 'black' | null; reason?: string; fen?: string }) => {
            if (payload.fen) {
                loadFen(payload.fen);
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
        },
        [loadFen],
    );

    const handleIncomingMove = useCallback(
        (data: {
            playerId: string;
            move: { from: string; to: string; promotion?: string; captured?: string };
            fen: string;
            turn: string;
            check?: boolean;
        }) => {
            try {
                loadFen(data.fen);
                setLastMove({
                    from: data.move.from as Square,
                    to: data.move.to as Square,
                    captured: data.move.captured,
                });
                setMessage(null);
            } catch (error) {
                console.error('Failed to process move payload', error);
            }
        },
        [loadFen, setLastMove],
    );

    const handleOpponentDisconnected = useCallback(() => {
        setMessage('Your opponent disconnected.');
    }, []);

    const handleMatchStart = useCallback(
        (payload: { status: 'matched' | 'already-playing'; gameId: string; color: 'white' | 'black'; fen: string }) => {
            if (payload.gameId !== gameId) return;

            const { color, fen } = payload;
            setRole(color);
            setPlayerColor(color);
            setGameStatus('started');
            setMessage(null);
            setShowShareLink(false);
            clearBanner();

            try {
                loadFen(fen);
                setLastMove(null);
            } catch (error) {
                console.error('Failed to load game state', error);
                handleReset();
            }
        },
        [gameId, loadFen, setLastMove, clearBanner, handleReset],
    );

    const handleSubscriptionError = useCallback(() => {
        setMessage('Unable to join private channel. Check your Pusher credentials.');
    }, []);

    // Subscriptions
    usePlayerChannel(pusherClient, playerId, handleMatchStart, handleSubscriptionError);

    useGameChannel(
        pusherClient,
        gameId,
        playerId,
        gameStatus !== 'not-started', // Subscribe only if we have joined/started
        {
            onMove: handleIncomingMove,
            onGameOver: handleGameOver,
            onOpponentLeft: handleOpponentLeft,
            onOpponentDisconnected: handleOpponentDisconnected,
        },
    );

    const handleJoinResult = useCallback(
        (result: JoinGameResponse) => {
            if (result.role === 'spectator') {
                setRole('spectator');
                setGameStatus('started');
                setMessage('You are spectating this game');
                setShowShareLink(false);
            } else if (result.color) {
                setPlayerColor(result.color);
                setRole(result.color);

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

            if (result.fen) {
                loadFen(result.fen);
            }
        },
        [loadFen],
    );

    // Join Game Logic
    useEffect(() => {
        if (!gameId || !playerId) return;

        let cancelled = false;

        const performJoin = async () => {
            try {
                const result = await joinGame(gameId, playerId);

                if (cancelled) return;

                handleJoinResult(result);
            } catch (error: any) {
                console.error('Failed to join game', error);
                if (!cancelled) {
                    setMessage(error.message || 'Failed to join game. Please try again.');
                }
            }
        };

        performJoin();

        return () => {
            cancelled = true;
        };
    }, [gameId, playerId, handleJoinResult]);

    // Refresh state on visibility change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && gameId && playerId) {
                joinGame(gameId, playerId)
                    .then((result) => {
                        handleJoinResult(result);
                    })
                    .catch((error) => {
                        console.error('Failed to refresh game state', error);
                    });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [gameId, playerId, handleJoinResult]);

    // Leave Notification
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (gameId && playerId) {
                notifyLeave(gameId, playerId);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (gameId && playerId) {
                notifyLeave(gameId, playerId);
            }
        };
    }, [gameId, playerId]);

    // Local Move Handler
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
            if (turn !== expectedTurn) {
                setMessage("It isn't your turn yet.");
                return;
            }

            const result = makeMove(move);

            if (!result) {
                setMessage('Illegal move');
                return;
            }

            setMessage(null);
            // Banner update handled by effect

            submitMove(playerId, move).catch((error) => {
                console.error('Failed to send move', error);
                setMessage('Failed to send move to server');
                undoMove();
            });
        },
        [isSpectator, gameStatus, playerColor, playerId, turn, makeMove, undoMove],
    );

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
                cameraLocked={cameraLocked}
                onToggleCameraLock={() => setCameraLocked((v) => !v)}
            />

            <Canvas
                shadows
                className="bg-gradient-to-b from-zinc-600 to-zinc-800"
                camera={{ position: [10, 10, 10], fov: 20 }}
                style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}
            >
                <CameraAnimator playerColor={playerColor} />
                <ChessBoard
                    board={board}
                    onMove={handleLocalMove}
                    getLegalMoves={getLegalMoves}
                    gameStatus={gameStatus}
                    playerColor={playerColor}
                    lastMove={lastMove}
                    isSpectator={isSpectator}
                    cameraLocked={cameraLocked}
                />
            </Canvas>
        </div>
    );
};

export default GamePage;
