import type { Piece, Square } from 'chess.js';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { AnimatedPiece, PieceComponent } from '@/components/3d/piece';
import { getSquare, squareToPosition } from '@/lib/board';
import type { ChessMove, GameStatus } from '@/types/game';

export type ChessBoardProps = {
    board: (Piece | null)[][];
    onMove: (move: { from: Square; to: Square }) => void;
    getLegalMoves: (square: Square) => Square[];
    gameStatus: GameStatus;
    playerColor: string | null;
    lastMove: ChessMove | null;
    isSpectator?: boolean;
};

export const useBoardElements = ({
    board,
    onMove,
    getLegalMoves,
    gameStatus,
    playerColor,
    lastMove,
    isSpectator = false,
}: ChessBoardProps) => {
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

    const validMoves = useMemo(() => {
        if (!selectedSquare) return [];
        return getLegalMoves(selectedSquare);
    }, [selectedSquare, getLegalMoves]);

    const isSelected = useCallback(
        (row: number, col: number) => {
            return selectedSquare === getSquare(row, col);
        },
        [selectedSquare],
    );

    const isValidMove = useCallback(
        (row: number, col: number) => {
            const square = getSquare(row, col);
            return validMoves.includes(square);
        },
        [validMoves],
    );

    const handleSquareClick = useCallback(
        (row: number, col: number) => {
            if (isSpectator) {
                return;
            }

            if (gameStatus === 'waiting-opponent') {
                alert('Game has not started yet.');
                return;
            }

            const clickedSquare = getSquare(row, col);
            const piece = board[row][col];
            if (!selectedSquare) {
                if (piece && piece.color !== playerColor?.[0] && gameStatus === 'started') {
                    alert('You cannot select your opponent’s pieces.');
                    return;
                }
                if (piece) {
                    setSelectedSquare(clickedSquare);
                }
                return;
            }

            if (selectedSquare === clickedSquare) {
                setSelectedSquare(null);
                return;
            }

            const move = { from: selectedSquare, to: clickedSquare };
            onMove(move);
            setSelectedSquare(null);
        },
        [selectedSquare, board, onMove, gameStatus, playerColor, isSpectator],
    );

    const boardElements = useMemo(() => {
        return board.map((rowArr, row) =>
            rowArr.map((piece, col) => {
                const isWhiteSquare = (row + col) % 2 === 1;
                const squarePos: [number, number, number] = [col - 3.5, 0, row - 3.5];
                const highlight = isSelected(row, col);
                const canMoveTo = isValidMove(row, col);
                let squareColor = isWhiteSquare ? '#FFFFF0' : '#5d9948';
                if (highlight) {
                    squareColor = '#f7e26b';
                } else if (canMoveTo) {
                    squareColor = piece ? '#ff6b6b' : '#f7e26b';
                }

                return (
                    <group key={`square-${row}-${col}`} onClick={() => handleSquareClick(row, col)}>
                        <mesh position={squarePos} receiveShadow castShadow>
                            <boxGeometry args={[1, 0.2, 1]} />
                            <meshStandardMaterial color={squareColor} />
                        </mesh>

                        {piece && (
                            <group>
                                <Suspense fallback={null}>
                                    {lastMove?.to === getSquare(row, col) ? (
                                        <AnimatedPiece
                                            from={lastMove.from}
                                            to={lastMove.to}
                                            captured={lastMove.captured}
                                        >
                                            <PieceComponent piece={piece} highlight={highlight} />
                                        </AnimatedPiece>
                                    ) : (
                                        <group position={squareToPosition(getSquare(row, col))}>
                                            <PieceComponent piece={piece} highlight={highlight} />
                                        </group>
                                    )}
                                </Suspense>
                                {highlight && (
                                    <pointLight
                                        position={[col - 3.5, 0.5, row - 3.5]}
                                        color={piece.color === 'w' ? '#ffffaa' : '#ffaaff'}
                                        intensity={8}
                                        distance={5}
                                        decay={1.5}
                                    />
                                )}
                            </group>
                        )}
                    </group>
                );
            }),
        );
    }, [board, isSelected, handleSquareClick, isValidMove, lastMove]);

    return boardElements;
};
