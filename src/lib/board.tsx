import type { Square } from 'chess.js';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export const getSquare = (row: number, col: number): Square => {
    return (FILES[col] + (8 - row)) as Square;
};

export const squareToPosition = (square: Square): [number, number, number] => {
    const file = square[0];
    const rank = square[1];
    const col = FILES.indexOf(file as (typeof FILES)[number]);
    const row = 8 - parseInt(rank, 10);
    return [col - 3.5, 0.25, row - 3.5];
};
