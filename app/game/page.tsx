"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Chess, type Square } from "chess.js";

import ChessBoard from "@/components/3d/chessBoard";
import GameStatusPanel from "@/components/GameStatusPanel";
import { INIT_GAME, MOVE, OPPONENT_LEFT, GAME_OVER, ERROR, KEEPALIVE } from "@/types/socket";
import type { ChessMove, GameStatus, SocketMessage } from "@/types/game";

const GamePage: React.FC = () => {
  const playerIdRef = useRef<string>();
  if (!playerIdRef.current) {
    playerIdRef.current = crypto.randomUUID();
  }
  const playerId = playerIdRef.current;

  const eventSourceRef = useRef<EventSource | null>(null);
  const gameRef = useRef(new Chess());

  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>("not-started");
  const [playerColor, setPlayerColor] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [lastFen, setLastFen] = useState(gameRef.current.fen());
  const [lastMove, setLastMove] = useState<ChessMove | null>(null);

  const board = useMemo(() => gameRef.current.board(), [lastFen]);

  const resetBoard = useCallback(() => {
    gameRef.current.reset();
    setLastFen(gameRef.current.fen());
    setLastMove(null);
  }, []);

  const handleServerMessage = useCallback(
    (data: SocketMessage) => {
      switch (data.type) {
        case INIT_GAME: {
          resetBoard();
          setGameStatus("started");
          setPlayerColor(data.payload?.color ?? null);
          setMessage(null);
          setBannerMessage(null);
          break;
        }
        case MOVE: {
          if (data.payload?.from && data.payload?.to) {
            const moveResult = gameRef.current.move({
              from: data.payload.from as Square,
              to: data.payload.to as Square,
              promotion: "q",
            });
            if (moveResult) {
              setLastMove({
                from: data.payload.from as Square,
                to: data.payload.to as Square,
              });
              setLastFen(gameRef.current.fen());
            }
          }
          break;
        }
        case OPPONENT_LEFT: {
          setGameStatus("not-started");
          setMessage("Your opponent has left the game. Queue again to find a new match.");
          setPlayerColor(null);
          resetBoard();
          break;
        }
        case GAME_OVER: {
          const winner = data.payload?.winner;
          if (winner) {
            setBannerMessage(`Game Over - ${winner} wins`);
            setMessage(null);
          } else {
            setBannerMessage("Game Over");
          }
          setGameStatus("not-started");
          setPlayerColor(null);
          break;
        }
        case ERROR: {
          if (typeof data.payload?.message === "string") {
            setMessage(data.payload.message);
          }
          break;
        }
        default:
          break;
      }
    },
    [resetBoard],
  );

  useEffect(() => {
    const eventSource = new EventSource(`/api/game/stream?playerId=${playerId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setMessage(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: SocketMessage = JSON.parse(event.data);
        if (data.type === KEEPALIVE) {
          return;
        }
        handleServerMessage(data);
      } catch (error) {
        console.error("Invalid message from server", error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setMessage("Connection interrupted. Attempting to reconnect...");
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      setPlayerColor(null);
      setGameStatus("not-started");
    };
  }, [playerId, handleServerMessage]);

  useEffect(() => {
    if (gameRef.current.isCheckmate()) {
      setBannerMessage("Checkmate");
      return;
    }
    if (gameRef.current.isCheck()) {
      setBannerMessage("Check");
      const timeout = setTimeout(() => setBannerMessage(null), 2000);
      return () => clearTimeout(timeout);
    }
    setBannerMessage(null);
  }, [lastFen, gameStatus]);

  const handleStartGame = useCallback(async () => {
    if (!isConnected) {
      setMessage("Unable to start game while disconnected.");
      return;
    }

    resetBoard();
    setMessage(null);
    setBannerMessage(null);
    setPlayerColor(null);
    setGameStatus("waiting-opponent");

    try {
      const response = await fetch("/api/game/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to join queue" }));
        setMessage(error.error ?? "Failed to join queue");
        setGameStatus("not-started");
      } else {
        const result = await response.json();
        if (result.status === "alreadyPlaying") {
          setGameStatus("started");
        } else if (result.status === "waiting") {
          setMessage("Waiting for an opponent...");
        }
      }
    } catch (error) {
      console.error(error);
      setMessage("Unable to join the queue. Please try again.");
      setGameStatus("not-started");
    }
  }, [isConnected, playerId, resetBoard]);

  const handleLocalMove = useCallback(
    (move: { from: string; to: string }) => {
      if (gameStatus !== "started" || !playerColor) {
        return;
      }

      const expectedTurn = playerColor === "white" ? "w" : "b";
      if (gameRef.current.turn() !== expectedTurn) {
        setMessage("It isn't your turn yet.");
        return;
      }

      const availableMoves = gameRef.current.moves({ square: move.from as Square, verbose: true });
      const isLegalDestination = availableMoves.some((m) => m.to === move.to);
      if (!isLegalDestination) {
        setMessage("Illegal move");
        return;
      }

      const targetSquare = gameRef.current.get(move.to as Square);
      const captured = targetSquare ? targetSquare.type : undefined;

      const result = gameRef.current.move({
        from: move.from as Square,
        to: move.to as Square,
        promotion: "q",
      });

      if (result) {
        setLastMove({ from: move.from as Square, to: move.to as Square, captured });
        setLastFen(gameRef.current.fen());
        setMessage(null);

        fetch("/api/game/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, move }),
        }).catch((error) => {
          console.error(error);
          setMessage("Failed to send move to server");
        });
      }
    },
    [gameStatus, playerColor, playerId],
  );

  const getLegalMoves = useCallback((square: Square): Square[] => {
    const moves = gameRef.current.moves({ square, verbose: true });
    return moves.map((move) => move.to as Square);
  }, []);

  const turn = gameRef.current.turn();

  return (
    <div className="relative h-screen">
      {bannerMessage && (
        <div className="w-full z-50 h-20 text-2xl font-bold absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white text-white shadow-2xl">
          {bannerMessage}
        </div>
      )}

      <GameStatusPanel
        isConnected={isConnected}
        message={message}
        gameStatus={gameStatus}
        playerColor={playerColor}
        handleStartGame={handleStartGame}
        turn={turn}
      />

      <Canvas
        shadows
        className="bg-gradient-to-b from-black to-zinc-700"
        camera={{ position: [10, 10, 10], fov: 20 }}
        style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%" }}
      >
        <ChessBoard
          board={board}
          onMove={handleLocalMove}
          getLegalMoves={getLegalMoves}
          gameStatus={gameStatus}
          playerColor={playerColor}
          lastMove={lastMove}
        />
      </Canvas>
    </div>
  );
};

export default GamePage;
