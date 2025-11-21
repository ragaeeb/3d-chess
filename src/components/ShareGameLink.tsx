'use client';

import { Check, Copy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type ShareGameLinkProps = { gameId: string; onClose: () => void };

const ShareGameLink = ({ gameId, onClose }: ShareGameLinkProps) => {
    const [copied, setCopied] = useState(false);
    const resetTimeoutRef = useRef<number | null>(null);
    const url = typeof window !== 'undefined' ? `${window.location.origin}/game/${gameId}` : '';

    const copyToClipboard = async () => {
        if (!url || typeof navigator === 'undefined' || !navigator.clipboard) {
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            if (resetTimeoutRef.current) {
                window.clearTimeout(resetTimeoutRef.current);
            }
            resetTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy', error);
        }
    };

    useEffect(() => {
        return () => {
            if (resetTimeoutRef.current) {
                window.clearTimeout(resetTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/60 transition-colors hover:text-white"
                    aria-label="Close"
                    type="button"
                >
                    <X className="h-6 w-6" />
                </button>

                <h2 className="mb-6 text-center font-bold text-2xl text-white">Share Game Link</h2>

                <div className="mb-4">
                    <p className="mb-2 text-center text-sm text-white/80">Send this link to your opponent:</p>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={url}
                            readOnly
                            className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white outline-none"
                        />
                        <button
                            onClick={copyToClipboard}
                            className="rounded-lg bg-gradient-to-b from-[#d3d3ad] to-[#315a22] p-3 text-white transition-all hover:scale-105"
                            aria-label="Copy link"
                            type="button"
                        >
                            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                <p className="text-center text-white/60 text-xs">
                    Others can use this link to spectate after the game starts
                </p>
            </div>
        </div>
    );
};

export default ShareGameLink;
