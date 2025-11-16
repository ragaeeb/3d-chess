'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const HeroSection = () => {
    const router = useRouter();

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-t from-black to-zinc-700 py-20 font-mono text-white">
            <h1 className="font-bold text-7xl">Chess</h1>
            <Image
                src="/picture/hero-section.png"
                alt="3D chess hero"
                width={640}
                height={480}
                priority
                className="my-8 h-auto w-auto max-w-full"
            />
            <div className="flex gap-4">
                <button
                    type="button"
                    onClick={() => router.push('/game/new')}
                    className="group relative inline-flex h-12 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-green-200 bg-[#5d9948] px-6 font-medium text-white transition-all duration-100 [box-shadow:5px_5px_rgb(82_82_82)] active:translate-x-[3px] active:translate-y-[3px] active:[box-shadow:0px_0px_rgb(82_82_82)]"
                >
                    Play Chess
                </button>
            </div>
            <Link
                href="https://github.com/ragaeeb/3d-chess"
                target="_blank"
                className="fixed top-5 right-4 inline-flex items-center justify-center gap-2 rounded-md font-medium text-sm text-white transition-all"
            >
                <svg width="32" height="32" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <title>GitHub</title>
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49C3.73 14.91 3.27 13.73 3.27 13.73c-.36-.91-.88-1.15-.88-1.15-.72-.49.05-.48.05-.48.8.06 1.22.82 1.22.82.71 1.21 1.87.86 2.33.66.07-.52.28-.86.51-1.06-2.22-.25-4.55-1.11-4.55-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 8 3.74c.85.0 1.7.12 2.49.35 1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.41.1 2.66.64.7 1.03 1.6 1.03 2.69 0 3.85-2.33 4.7-4.56 4.95.29.25.54.74.54 1.5 0 1.08-.01 1.95-.01 2.22 0 .21.15.46.55.38C13.71 14.53 16 11.53 16 8c0-4.42-3.58-8-8-8Z"
                        fill="#fff"
                    />
                </svg>
                GitHub
            </Link>
        </div>
    );
};

export default HeroSection;
