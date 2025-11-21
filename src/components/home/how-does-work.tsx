import { Clock, Gamepad2, Globe, Users, Zap } from 'lucide-react';
import {
    SiBiome,
    SiBun,
    SiFramer,
    SiGithub,
    SiNextdotjs,
    SiPusher,
    SiReact,
    SiRedis,
    SiTailwindcss,
    SiThreedotjs,
    SiTypescript,
    SiUpstash,
} from 'react-icons/si';
import LogoLoop from '@/components/react-bits/LogoLoop';

const techLogos = [
    {
        node: <SiReact className="text-slate-500 transition-colors hover:text-cyan-400" />,
        title: 'React',
        href: 'https://react.dev',
    },
    {
        node: <SiNextdotjs className="text-slate-500 transition-colors hover:text-white" />,
        title: 'Next.js',
        href: 'https://nextjs.org',
    },
    {
        node: <SiTypescript className="text-slate-500 transition-colors hover:text-blue-400" />,
        title: 'TypeScript',
        href: 'https://www.typescriptlang.org',
    },
    {
        node: <SiTailwindcss className="text-slate-500 transition-colors hover:text-cyan-300" />,
        title: 'Tailwind CSS',
        href: 'https://tailwindcss.com',
    },
    {
        node: <SiPusher className="text-slate-500 transition-colors hover:text-cyan-300" />,
        title: 'Pusher',
        href: 'https://pusher.com',
    },
    {
        node: <SiRedis className="text-slate-500 transition-colors hover:text-red-500" />,
        title: 'Redis',
        href: 'https://redis.io',
    },
    {
        node: <SiBun className="text-slate-500 transition-colors hover:text-white" />,
        title: 'Bun',
        href: 'https://bun.sh',
    },
    {
        node: <SiFramer className="text-slate-500 transition-colors hover:text-yellow-500" />,
        title: 'Motion',
        href: 'https://motion.dev',
    },
    {
        node: <SiThreedotjs className="text-slate-500 transition-colors hover:text-emerald-500" />,
        title: 'Three.js',
        href: 'https://threejs.org',
    },
    {
        node: <SiUpstash className="text-slate-500 transition-colors hover:text-green-500" />,
        title: 'Upstash',
        href: 'https://upstash.com',
    },
    {
        node: <SiGithub className="text-slate-500 transition-colors hover:text-white" />,
        title: 'GitHub',
        href: 'https://github.com',
    },
    {
        node: <SiBiome className="text-slate-500 transition-colors hover:text-blue-500" />,
        title: 'Biome',
        href: 'https://biomejs.dev',
    },
];

const HowDoesWork = () => {
    return (
        <div className="w-full bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-20 font-sans">
            <div className="mx-auto max-w-6xl">
                <LogoLoop
                    logos={techLogos}
                    speed={60}
                    direction="left"
                    logoHeight={48}
                    gap={120}
                    hoverSpeed={0}
                    scaleOnHover
                    fadeOut
                    fadeOutColor="#0f172a"
                    ariaLabel="Technology partners"
                    className="mb-12"
                />

                <div className="mb-16 text-center">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 backdrop-blur-sm">
                        <Zap className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-300 text-sm">Simple & Fast</span>
                    </div>
                    <h1 className="mb-6 font-bold text-5xl text-white">How Does It Work?</h1>
                    <p className="mx-auto max-w-3xl text-gray-400 text-xl">
                        Get started in seconds with our streamlined matchmaking system powered by real-time Pusher
                        technology.
                    </p>
                </div>

                <div className="mb-16 grid gap-8 md:grid-cols-3">
                    <div className="group transform rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-emerald-500/30 hover:bg-white/10">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-green-600">
                            <Gamepad2 className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="mb-4 text-center font-bold text-2xl text-white">Create Game</h3>
                        <p className="text-center text-gray-400 leading-relaxed">
                            Click "Play Chess" to instantly create a new game room. You'll be assigned a color and
                            placed in the matchmaking queue.
                        </p>
                    </div>

                    <div className="group transform rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-emerald-500/30 hover:bg-white/10">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-emerald-600">
                            <Users className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="mb-4 text-center font-bold text-2xl text-white">Share Link</h3>
                        <p className="text-center text-gray-400 leading-relaxed">
                            Copy your unique game link and share it with a friend, or wait for the next available player
                            to join your game.
                        </p>
                    </div>

                    <div className="group transform rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-emerald-500/30 hover:bg-white/10">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-emerald-600 to-green-700">
                            <Zap className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="mb-4 text-center font-bold text-2xl text-white">Play Live</h3>
                        <p className="text-center text-gray-400 leading-relaxed">
                            Once matched, the game starts immediately! Every move syncs in real-time with smooth 3D
                            animations on both boards.
                        </p>
                    </div>
                </div>

                <div className="mb-16 rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-sm">
                    <div className="mb-8 flex items-center justify-center">
                        <Clock className="mr-4 h-12 w-12 text-emerald-400" />
                        <h2 className="font-bold text-3xl text-white">Real-Time Technology</h2>
                    </div>

                    <div className="grid gap-8 md:grid-cols-2">
                        <div className="space-y-6">
                            <div className="flex items-start space-x-4">
                                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-green-600">
                                    <span className="font-bold text-sm text-white">1</span>
                                </div>
                                <div>
                                    <h4 className="mb-2 font-semibold text-lg text-white">Pusher Integration</h4>
                                    <p className="text-gray-400">
                                        Built on Pusher's WebSocket infrastructure for ultra-reliable real-time
                                        communication between players across the globe.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-emerald-600">
                                    <span className="font-bold text-sm text-white">2</span>
                                </div>
                                <div>
                                    <h4 className="mb-2 font-semibold text-lg text-white">3D Board Rendering</h4>
                                    <p className="text-gray-400">
                                        Powered by Three.js and React Three Fiber for stunning 3D graphics with
                                        hardware-accelerated animations.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/50 to-green-950/30 p-6 backdrop-blur-sm">
                            <h4 className="mb-4 flex items-center font-semibold text-lg text-white">
                                <Globe className="mr-2 h-5 w-5 text-emerald-400" />
                                Key Features
                            </h4>
                            <ul className="space-y-3 text-gray-300">
                                <li className="flex items-center">
                                    <div className="mr-3 h-2 w-2 rounded-full bg-emerald-400"></div>
                                    Live move synchronization via Pusher
                                </li>
                                <li className="flex items-center">
                                    <div className="mr-3 h-2 w-2 rounded-full bg-emerald-400"></div>
                                    Spectator mode for observers
                                </li>
                                <li className="flex items-center">
                                    <div className="mr-3 h-2 w-2 rounded-full bg-emerald-400"></div>
                                    Legal move validation with chess.js
                                </li>
                                <li className="flex items-center">
                                    <div className="mr-3 h-2 w-2 rounded-full bg-emerald-400"></div>
                                    Smooth piece animations
                                </li>
                                <li className="flex items-center">
                                    <div className="mr-3 h-2 w-2 rounded-full bg-emerald-400"></div>
                                    Persistent player identity
                                </li>
                                <li className="flex items-center">
                                    <div className="mr-3 h-2 w-2 rounded-full bg-emerald-400"></div>
                                    Check and checkmate detection
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 backdrop-blur-sm">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></div>
                        <span className="text-emerald-300 text-sm">Ready to play? Start your first game now!</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HowDoesWork;
