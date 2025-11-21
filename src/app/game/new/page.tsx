'use client';

import { Gamepad2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Aurora from '@/components/react-bits/Aurora';
import FadeContent from '@/components/react-bits/FadeContent';
import { ensurePlayerId } from '@/lib/playerIdentity';

export default function NewGamePage() {
    const router = useRouter();
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setPlayerId(ensurePlayerId());
    }, []);

    const createGame = async () => {
        if (!playerId) {
            return;
        }
        setCreating(true);
        setError(null);

        try {
            const res = await fetch('/.netlify/functions/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', playerId }),
            });

            if (!res.ok) {
                throw new Error('Failed to create game');
            }

            const { gameId } = await res.json();
            router.push(`/game/${gameId}`);
        } catch (err) {
            setError('Failed to create game. Please try again.');
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900">
            {/* Aurora Background */}
            <div className="absolute inset-0 opacity-30">
                <Aurora colorStops={['#10b981', '#34d399', '#059669']} amplitude={1.2} blend={0.6} speed={0.8} />
            </div>

            {/* Content */}
            <FadeContent blur duration={1000} easing="ease-out" initialOpacity={0}>
                <div className="relative z-10 text-center">
                    <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 backdrop-blur-sm">
                        <Gamepad2 className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-300 text-sm">Ready to Play</span>
                    </div>

                    <h1 className="mb-4 font-bold text-5xl text-white md:text-6xl">Create New Game</h1>

                    <p className="mb-12 text-gray-400 text-lg">Start a new chess game and invite your opponent</p>

                    {error && (
                        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/20 p-4 text-red-300 backdrop-blur-sm">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={createGame}
                        type="button"
                        disabled={creating || !playerId}
                        className="group relative inline-flex h-16 items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-12 font-semibold text-lg text-white shadow-emerald-500/25 shadow-lg transition-all hover:scale-105 hover:shadow-emerald-500/40 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {creating ? (
                            <>
                                <svg
                                    className="h-5 w-5 animate-spin"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <title>Creating Game</title>
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                Creating Game...
                            </>
                        ) : (
                            <>
                                <Gamepad2 className="h-5 w-5" />
                                Create Game
                            </>
                        )}
                    </button>

                    <p className="mt-6 text-gray-500 text-sm">Your game will be created instantly</p>
                </div>
            </FadeContent>
        </div>
    );
}
