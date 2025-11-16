'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ensurePlayerId, persistPlayerId } from '@/lib/playerIdentity';

export default function NewGamePage() {
    const router = useRouter();
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setPlayerId(ensurePlayerId());
    }, []);

    const createGame = async () => {
        setCreating(true);
        setError(null);

        try {
            const id = playerId ?? ensurePlayerId();
            setPlayerId(persistPlayerId(id));

            const res = await fetch('/.netlify/functions/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', playerId: id }),
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
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black to-zinc-700">
            <div className="text-center">
                <h1 className="mb-8 text-4xl font-bold text-white">Create New Game</h1>
                {error && (
                    <div className="mb-4 rounded-lg bg-red-500/20 border border-red-400/30 p-4 text-red-300">{error}</div>
                )}
                <button
                    onClick={createGame}
                    disabled={creating || !playerId}
                    className="rounded-xl bg-gradient-to-b from-[#d3d3ad] to-[#315a22] px-8 py-4 text-lg font-bold text-white transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {creating ? 'Creating...' : 'Create Game'}
                </button>
            </div>
        </div>
    );
}
