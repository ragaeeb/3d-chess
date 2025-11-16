"use client";

/// <reference types="@react-three/fiber" />

import { OrbitControls } from "@react-three/drei";
import { useSpring } from "@react-spring/core";
import { a } from "@react-spring/three";
import type { Piece, Square } from "chess.js";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { AnimatedPieceProps, ChessBoardProps } from "@/types/game";
import Lights from "./lights";
import { BishopModel, KingModel, KnightModel, PawnModel, QueenModel, RookModel } from "../models";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const LOOK_AT_TARGET = new Vector3(0, 0, 0);
const BOARD_BASE_HALF_SIZE = 4.4; // Board base is 8.8 units wide
const BOARD_CORNERS = [
  new Vector3(-BOARD_BASE_HALF_SIZE, 0, -BOARD_BASE_HALF_SIZE),
  new Vector3(-BOARD_BASE_HALF_SIZE, 0, BOARD_BASE_HALF_SIZE),
  new Vector3(BOARD_BASE_HALF_SIZE, 0, -BOARD_BASE_HALF_SIZE),
  new Vector3(BOARD_BASE_HALF_SIZE, 0, BOARD_BASE_HALF_SIZE),
];
const CAMERA_DIRECTIONS = {
  white: new Vector3(0, 1, 1).normalize(),
  black: new Vector3(0, 1, -1).normalize(),
} as const;

const squareToPosition = (square: Square): [number, number, number] => {
  const file = square[0];
  const rank = square[1];
  const col = FILES.indexOf(file as typeof FILES[number]);
  const row = 8 - parseInt(rank, 10);
  return [col - 3.5, 0.25, row - 3.5];
};

const computeBoardViewDistance = (fov: number) => {
  const halfFov = (Math.max(fov, 1) * Math.PI) / 360;
  const direction = CAMERA_DIRECTIONS.white;

  const exceedsFov = (distance: number) => {
    const cameraPosition = direction.clone().multiplyScalar(distance);
    const forward = LOOK_AT_TARGET.clone().sub(cameraPosition).normalize();
    let maxAngle = 0;

    for (const corner of BOARD_CORNERS) {
      const vectorToCorner = corner.clone().sub(cameraPosition).normalize();
      const angle = forward.angleTo(vectorToCorner);
      maxAngle = Math.max(maxAngle, angle);
    }

    return maxAngle > halfFov;
  };

  let low = 2;
  let high = 80;
  for (let i = 0; i < 25; i += 1) {
    const mid = (low + high) / 2;
    if (exceedsFov(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high * 1.05; // add a slight margin so the board comfortably fits
};

const getSquare = (row: number, col: number): Square => {
  return (FILES[col] + (8 - row)) as Square;
};

const AnimatedPiece = ({ from, to, children }: AnimatedPieceProps) => {
  const fromPos = useMemo(() => squareToPosition(from), [from]);
  const toPos = useMemo(() => squareToPosition(to), [to]);
  const { position } = useSpring({
    from: { position: fromPos },
    to: { position: toPos },
    config: { mass: 200, tension: 900, friction: 200, clamp: true },
  });

  return <a.group position={position as unknown as [number, number, number]}>{children}</a.group>;
};

const PieceComponent = ({ piece, highlight }: { piece: Piece; highlight: boolean }) => (
  <group castShadow>
    {piece.type === "p" && <PawnModel position={[0, 0.03, 0]} color={piece.color === "w" ? "#e0e0e0" : "#222"} />}
    {piece.type === "r" && <RookModel position={[0, 0.19, 0]} color={piece.color === "w" ? "#e0e0e0" : "#222"} />}
    {piece.type === "n" && <KnightModel position={[0, 0.22, 0]} color={piece.color === "w" ? "#e0e0e0" : "#222"} />}
    {piece.type === "b" && <BishopModel position={[0, 0.25, 0]} color={piece.color === "w" ? "#e0e0e0" : "#222"} />}
    {piece.type === "q" && <QueenModel position={[0, 0.32, 0]} color={piece.color === "w" ? "#e0e0e0" : "#222"} />}
    {piece.type === "k" && <KingModel position={[0, 0.9, 0]} color={piece.color === "w" ? "#e0e0e0" : "#222"} />}
    <meshStandardMaterial
      color={piece.color === "w" ? "#e0e0e0" : "#222"}
      emissive={highlight ? (piece.color === "w" ? "#444400" : "#220022") : "#000000"}
      emissiveIntensity={highlight ? 0.3 : 0}
    />
  </group>
);

const ChessBoard: React.FC<ChessBoardProps> = ({
  board,
  onMove,
  getLegalMoves,
  gameStatus,
  playerColor,
  lastMove,
  isSpectator = false,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const boardViewDistance = useMemo(() => computeBoardViewDistance(camera.fov), [camera.fov]);

  useEffect(() => {
    const defaultPosition = CAMERA_DIRECTIONS.white.clone().multiplyScalar(boardViewDistance);
    camera.position.copy(defaultPosition);
    camera.lookAt(LOOK_AT_TARGET);
    if (controlsRef.current) {
      controlsRef.current.target.copy(LOOK_AT_TARGET);
      controlsRef.current.minDistance = boardViewDistance * 0.7;
      controlsRef.current.maxDistance = boardViewDistance * 2.5;
      controlsRef.current.update();
    }
  }, [boardViewDistance, camera]);

  useEffect(() => {
    if (!playerColor || gameStatus !== "started") {
      return;
    }

    const direction = playerColor === "black" ? CAMERA_DIRECTIONS.black : CAMERA_DIRECTIONS.white;
    const targetPosition = direction.clone().multiplyScalar(boardViewDistance);
    const startPosition = camera.position.clone();
    const startTarget = controlsRef.current?.target.clone() ?? new Vector3(0, 0, 0);
    const lookAtTarget = LOOK_AT_TARGET.clone();
    const duration = 800;
    let animationFrame = 0;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      camera.position.lerpVectors(startPosition, targetPosition, progress);
      camera.lookAt(lookAtTarget);

      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(startTarget, lookAtTarget, progress);
        controlsRef.current.minDistance = boardViewDistance * 0.7;
        controlsRef.current.maxDistance = boardViewDistance * 2.5;
        controlsRef.current.update();
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [boardViewDistance, camera, gameStatus, playerColor]);

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

      if (gameStatus === "waiting-opponent") {
        alert("Game has not started yet.");
        return;
      }

      const clickedSquare = getSquare(row, col);
      const piece = board[row][col];
      if (!selectedSquare) {
        if (piece && piece.color !== playerColor?.[0] && gameStatus === "started") {
          alert("You cannot select your opponent’s pieces.");
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
        let squareColor = isWhiteSquare ? "#FFFFF0" : "#5d9948";
        if (highlight) {
          squareColor = "#f7e26b";
        } else if (canMoveTo) {
          squareColor = piece ? "#ff6b6b" : "#f7e26b";
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
                    <AnimatedPiece from={lastMove.from} to={lastMove.to} captured={lastMove.captured}>
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
                    color={piece.color === "w" ? "#ffffaa" : "#ffaaff"}
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

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        minDistance={boardViewDistance * 0.7}
        maxDistance={boardViewDistance * 2.5}
      />
      <Lights />
      <mesh receiveShadow position={[0, -0.16, 0]}>
        <boxGeometry args={[8.8, 0.3, 8.8]} />
        <meshStandardMaterial color="#1a1818" />
      </mesh>
      {boardElements}
    </>
  );
};

export default ChessBoard;
