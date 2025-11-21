import { Chess, type Square } from 'chess.js';
import { useCallback, useState } from 'react';
import type { ChessMove } from '@/types/game';

export function useChessGame() {
    const [game] = useState(() => new Chess());
    const [board, setBoard] = useState(() => game.board());
    const [lastMove, setLastMove] = useState<ChessMove | null>(null);

    const resetGame = useCallback(() => {
        game.reset();
        setBoard(game.board());
        setLastMove(null);
    }, [game]);

    const loadFen = useCallback(
        (fen: string) => {
            try {
                game.load(fen);
                setBoard(game.board());
                // Note: We might want to clear lastMove here or handle it separately depending on context
                // For now, we'll leave it as is or let the caller handle it if needed,
                // but usually loading a FEN means a new state where lastMove might not be known or relevant immediately.
            } catch (error) {
                console.error('Failed to load game state', error);
                throw error;
            }
        },
        [game],
    );

    const makeMove = useCallback(
        (move: { from: string; to: string; promotion?: string }) => {
            try {
                const result = game.move({
                    from: move.from as Square,
                    to: move.to as Square,
                    promotion: move.promotion || 'q',
                });
                if (!result) {
                    return null;
                }
                setBoard(game.board());
                setLastMove({
                    from: move.from as Square,
                    to: move.to as Square,
                    captured: result.captured ?? undefined,
                });
                return result;
            } catch (_e) {
                return null;
            }
        },
        [game],
    );

    const undoMove = useCallback(() => {
        game.undo();
        setBoard(game.board());
        setLastMove(null); // Or restore previous move if we tracked history, but for now null is safe
    }, [game]);

    const getLegalMoves = useCallback(
        (square: Square): Square[] => {
            const moves = game.moves({ square, verbose: true });
            return moves.map((m) => m.to as Square);
        },
        [game],
    );

    return {
        game,
        board,
        lastMove,
        setLastMove,
        turn: game.turn(),
        isCheck: game.isCheck(),
        isCheckmate: game.isCheckmate(),
        resetGame,
        loadFen,
        makeMove,
        undoMove,
        getLegalMoves,
    };
}
