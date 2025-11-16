import type { Metadata } from 'next';
import './globals.css';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: '3D Chess', description: 'Play immersive 3D chess in your browser.' };

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
        </html>
    );
}
