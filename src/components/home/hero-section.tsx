import Link from 'next/link';
import pkg from '@/../package.json';
import Squares from '@/components/react-bits/Squares';

const url = pkg.homepage;

const HeroSection = () => {
    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-slate-900 py-20 font-sans text-white">
            <div className="absolute inset-0 z-0 opacity-20">
                <Squares
                    direction="diagonal"
                    speed={0.5}
                    squareSize={120}
                    borderColor="rgba(255, 255, 255, 0.05)"
                    hoverFillColor="#f7e26b"
                />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center px-4">
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 backdrop-blur-sm">
                    <svg
                        className="h-4 w-4 text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                    >
                        <title>3D Chess Icon</title>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25"
                        />
                    </svg>
                    <span className="text-emerald-300 text-sm">Real-time 3D Chess</span>
                </div>

                <h1 className="mb-6 max-w-5xl text-center font-bold text-6xl text-white leading-tight md:text-8xl">
                    Immersive 3D Chess
                    <br />
                    <span className="bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
                        Multiplayer Experience
                    </span>
                </h1>

                <p className="mb-12 max-w-2xl text-center text-gray-300 text-xl">
                    Play chess in stunning 3D with real-time multiplayer. Challenge opponents worldwide with smooth
                    animations and an immersive board experience.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link
                        href="/game/new"
                        className="group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-10 font-semibold text-base text-white shadow-emerald-500/25 shadow-lg transition-all hover:scale-105 hover:shadow-emerald-500/40 hover:shadow-xl"
                    >
                        Play Chess
                    </Link>
                    <Link
                        href={url}
                        target="_blank"
                        className="group relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full border border-white/20 bg-white/5 px-10 font-semibold text-base text-white backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/10"
                    >
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <title>GitHub</title>
                            <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49C3.73 14.91 3.27 13.73 3.27 13.73c-.36-.91-.88-1.15-.88-1.15-.72-.49.05-.48.05-.48.8.06 1.22.82 1.22.82.71 1.21 1.87.86 2.33.66.07-.52.28-.86.51-1.06-2.22-.25-4.55-1.11-4.55-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 8 3.74c.85.0 1.7.12 2.49.35 1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.41.1 2.66.64.7 1.03 1.6 1.03 2.69 0 3.85-2.33 4.7-4.56 4.95.29.25.54.74.54 1.5 0 1.08-.01 1.95-.01 2.22 0 .21.15.46.55.38C13.71 14.53 16 11.53 16 8c0-4.42-3.58-8-8-8Z"
                                fill="currentColor"
                            />
                        </svg>
                        View on GitHub
                    </Link>
                </div>

                <div className="fixed top-8 right-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-4 py-2 backdrop-blur-sm">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-emerald-400/50 shadow-lg"></div>
                    <span className="text-emerald-300 text-sm">Live Multiplayer</span>
                </div>
            </div>
        </div>
    );
};

export default HeroSection;
