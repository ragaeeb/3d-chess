import { useSpring } from '@react-spring/core';
import { a } from '@react-spring/three';
import type { Piece, Square } from 'chess.js';
import { type ReactNode, useMemo } from 'react';
import { squareToPosition } from '@/lib/board';
import { BishopModel, KingModel, KnightModel, PawnModel, QueenModel, RookModel } from '../models';

type AnimatedPieceProps = { from: Square; to: Square; captured?: string | boolean; children: ReactNode };

export const AnimatedPiece = ({ from, to, children }: AnimatedPieceProps) => {
    const fromPos = useMemo(() => squareToPosition(from), [from]);
    const toPos = useMemo(() => squareToPosition(to), [to]);
    const { position } = useSpring({
        from: { position: fromPos },
        to: { position: toPos },
        config: { mass: 200, tension: 900, friction: 200, clamp: true },
    });

    return <a.group position={position as unknown as [number, number, number]}>{children}</a.group>;
};

export const PieceComponent = ({ piece, highlight }: { piece: Piece; highlight: boolean }) => {
    return (
        <group castShadow>
            {piece.type === 'p' && (
                <PawnModel position={[0, 0.03, 0]} color={piece.color === 'w' ? '#e0e0e0' : '#222'} />
            )}
            {piece.type === 'r' && (
                <RookModel position={[0, 0.19, 0]} color={piece.color === 'w' ? '#e0e0e0' : '#222'} />
            )}
            {piece.type === 'n' && (
                <KnightModel position={[0, 0.22, 0]} color={piece.color === 'w' ? '#e0e0e0' : '#222'} />
            )}
            {piece.type === 'b' && (
                <BishopModel position={[0, 0.25, 0]} color={piece.color === 'w' ? '#e0e0e0' : '#222'} />
            )}
            {piece.type === 'q' && (
                <QueenModel position={[0, 0.32, 0]} color={piece.color === 'w' ? '#e0e0e0' : '#222'} />
            )}
            {piece.type === 'k' && (
                <KingModel position={[0, 0.9, 0]} color={piece.color === 'w' ? '#e0e0e0' : '#222'} />
            )}
            <meshStandardMaterial
                color={piece.color === 'w' ? '#e0e0e0' : '#222'}
                emissive={highlight ? (piece.color === 'w' ? '#444400' : '#220022') : '#000000'}
                emissiveIntensity={highlight ? 0.3 : 0}
            />
        </group>
    );
};
