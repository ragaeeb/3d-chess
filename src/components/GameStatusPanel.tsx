'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { GameStatus, PlayerRole } from '@/types/game';

const SpectatorSection = ({
    canPlayAsOpponent,
    onClaimSeat,
    isClaimingSeat,
}: {
    canPlayAsOpponent: boolean;
    onClaimSeat?: () => void;
    isClaimingSeat: boolean;
}) => (
    <div className="space-y-4 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-400 to-purple-400">
            <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <title>Spectating</title>
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
        </div>
        <h2 className="font-semibold text-white/90 text-xl">Spectator Mode</h2>
        <p className="text-white/60">Watching the game in progress</p>
        {canPlayAsOpponent && onClaimSeat && (
            <div className="space-y-3">
                <p className="text-white/50 text-sm">Ready to jump in? Claim the open seat to start playing.</p>
                <button
                    type="button"
                    onClick={onClaimSeat}
                    disabled={isClaimingSeat}
                    className="w-full rounded-full bg-emerald-500 px-6 py-3 font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
                >
                    {isClaimingSeat ? 'Claiming seat...' : 'Play as Opponent'}
                </button>
            </div>
        )}
    </div>
);

const NotStartedSection = () => (
    <div className="space-y-4 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-[#FFFFF0] to-[#5d9948]">
            <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
        </div>
        <h2 className="font-semibold text-white/90 text-xl">Ready to Play?</h2>
        <p className="text-white/60">Click the button below to start your adventure</p>
    </div>
);

const WaitingOpponentSection = () => (
    <div className="space-y-4 text-center">
        <div className="relative mx-auto mb-4 h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-blue-400/30"></div>
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-400"></div>
            <div className="absolute inset-2 flex items-center justify-center rounded-full bg-gradient-to-r from-[#FFFFF0] to-[#5d9948]">
                <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <title>WaitingForOpponent</title>
                    <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"
                        clipRule="evenodd"
                    />
                </svg>
            </div>
        </div>
        <h2 className="font-semibold text-white/90 text-xl">Finding Opponent</h2>
        <p className="text-white/60">Please wait while we match you with another player...</p>
        <div className="flex justify-center space-x-1">
            <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400"></div>
            <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '0.1s' }}></div>
            <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '0.2s' }}></div>
        </div>
    </div>
);

const ActiveGameSection = ({ playerColor }: { playerColor: string }) => (
    <div className="space-y-4 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-gradient-to-r from-[#FFFFF0] to-[#5d9948]">
            <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <title>GameActive</title>
                <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                />
            </svg>
        </div>
        <h2 className="font-semibold text-white/90 text-xl">Game Active!</h2>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2">
            <div className={`h-3 w-3 rounded-full ${playerColor === 'white' ? 'bg-white' : 'bg-gray-800'}`}></div>
            <span className="font-medium text-white/90">Playing as {playerColor}</span>
        </div>
    </div>
);

const StatusCards = ({
    role,
    gameStatus,
    playerColor,
    canPlayAsOpponent,
    onClaimSeat,
    isClaimingSeat,
}: {
    role: PlayerRole | null;
    gameStatus: GameStatus;
    playerColor: string | null;
    canPlayAsOpponent: boolean;
    onClaimSeat?: () => void;
    isClaimingSeat: boolean;
}) => {
    if (role === 'spectator') {
        return (
            <SpectatorSection
                canPlayAsOpponent={canPlayAsOpponent}
                onClaimSeat={onClaimSeat}
                isClaimingSeat={isClaimingSeat}
            />
        );
    }

    if (gameStatus === 'not-started') {
        return <NotStartedSection />;
    }

    if (gameStatus === 'waiting-opponent') {
        return <WaitingOpponentSection />;
    }

    if (gameStatus === 'started' && playerColor) {
        return <ActiveGameSection playerColor={playerColor} />;
    }

    return null;
};

const resolveStatusLabel = (
    role: PlayerRole | null,
    gameStatus: GameStatus,
    playerColor: string | null,
    turn: string,
) => {
    if (role === 'spectator') {
        return 'Spectating';
    }

    if (gameStatus === 'started') {
        return turn === playerColor?.[0] ? 'Your Turn' : "Opponent's Turn";
    }

    if (gameStatus === 'waiting-opponent') {
        return 'Waiting for opponent';
    }

    return 'Start the game';
};

const ConnectionIndicator = ({ isConnected }: { isConnected: boolean }) => (
    <div className="flex items-center justify-between gap-3">
        <div className="pr-4 font-medium text-sm text-white/80">{isConnected ? 'Connected' : 'Disconnected'}</div>
        <div className="relative">
            {isConnected ? (
                <div className="h-4 w-4 animate-pulse rounded-full bg-emerald-400 shadow-emerald-400/50 shadow-lg">
                    <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75"></div>
                </div>
            ) : (
                <div className="h-4 w-4 rounded-full bg-red-400 shadow-lg shadow-red-400/50"></div>
            )}
        </div>
    </div>
);

const MessageAlert = ({ message }: { message: string | null }) =>
    message ? (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/20 p-4 backdrop-blur-sm">
            <p className="text-center font-medium text-red-300">{message}</p>
        </div>
    ) : null;

type GameStatusPanelProps = {
    isConnected: boolean;
    message: string | null;
    gameStatus: GameStatus;
    playerColor: string | null;
    role: PlayerRole | null;
    turn: string;
    canPlayAsOpponent?: boolean;
    onClaimSeat?: () => void;
    isClaimingSeat?: boolean;
};

const GameStatusPanel: React.FC<GameStatusPanelProps> = ({
    isConnected,
    message,
    gameStatus,
    playerColor,
    role,
    turn,
    canPlayAsOpponent = false,
    onClaimSeat,
    isClaimingSeat = false,
}) => {
    const [open, setOpen] = useState(true);
    const statusLabel = resolveStatusLabel(role, gameStatus, playerColor, turn);

    return (
        <div className="fixed right-8 bottom-8 z-10">
            <motion.div
                className="w-96 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl"
                animate={{ height: open ? 'auto' : 70 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                layout
            >
                <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between px-8 py-6 focus:outline-none"
                    onClick={() => setOpen((v) => !v)}
                    aria-label={open ? 'Collapse status panel' : 'Expand status panel'}
                    style={{ background: 'transparent', border: 'none' }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="pr-4 font-medium text-sm text-white/80">{statusLabel}</div>
                        <ConnectionIndicator isConnected={isConnected} />
                    </div>
                    <span className="ml-2 text-white/60">
                        <svg
                            className={`h-5 w-5 transition-transform duration-300 ${!open ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                        >
                            <title>Connection</title>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </span>
                </button>
                <AnimatePresence initial={false}>
                    {open && (
                        <motion.div
                            key="panel"
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.25 }}
                            className="px-8 pb-8"
                        >
                            <MessageAlert message={message} />
                            <div className="mb-8">
                                <StatusCards
                                    role={role}
                                    gameStatus={gameStatus}
                                    playerColor={playerColor}
                                    canPlayAsOpponent={canPlayAsOpponent}
                                    onClaimSeat={onClaimSeat}
                                    isClaimingSeat={isClaimingSeat}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default GameStatusPanel;
