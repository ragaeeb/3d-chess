import type { Piece, Square } from 'chess.js';
import type { ReactNode } from 'react';
export type GameStatus = 'not-started' | 'waiting-opponent' | 'started';

export type MovePayload = { from: string; to: string };

export interface AnimatedPieceProps {
    from: Square;
    to: Square;
    captured?: string | boolean;
    children: ReactNode;
}

export type ChessBoardProps = {
    board: (Piece | null)[][];
    onMove: (move: { from: Square; to: Square }) => void;
    getLegalMoves: (square: Square) => Square[];
    gameStatus: GameStatus;
    playerColor: string | null;
    lastMove: ChessMove | null;
};

export type ChessMove = { from: Square; to: Square; captured?: string };
