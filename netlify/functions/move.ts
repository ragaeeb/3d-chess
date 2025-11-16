import { randomUUID } from 'node:crypto';
import { Chess } from 'chess.js';
import { GAME_OVER, INIT_GAME, MOVE, OPPONENT_LEFT } from '../../src/types/socket';
import {
    claimWaitingPlayer,
    clearWaitingPlayer,
    getAssignment,
    getGameRecord,
    removeAssignment,
    removeGameRecord,
    saveGameRecord,
    setAssignment,
    setWaitingPlayer,
    updateGameFen,
} from './utils/gameStore';
import type { PlayerColor, GameRecord } from './utils/gameStore';
import type { NetlifyEvent, NetlifyResponse } from './utils/http';
import { jsonResponse, textResponse } from './utils/http';
import { getServerPusher } from './utils/pusher';

type QueueActionResponse =
    | { status: 'waiting' }
    | { status: 'matched' | 'already-playing'; gameId: string; color: PlayerColor; fen: string };

type MoveAction = { from: string; to: string; promotion?: string };

type RequestBody = { action?: 'queue' | 'move' | 'leave'; playerId?: string; move?: MoveAction };

const respond = (statusCode: number, data: unknown): NetlifyResponse => jsonResponse(statusCode, data);

const getOpponentId = (game: GameRecord, color: PlayerColor) =>
    color === 'white' ? game.players.black : game.players.white;

const triggerGameStart = async (
    playerId: string,
    payload: QueueActionResponse & { status: 'matched' | 'already-playing' },
) => {
    await getServerPusher().trigger(`private-player-${playerId}`, INIT_GAME, payload);
};

const handleQueue = async (playerId: string): Promise<NetlifyResponse> => {
    const existing = await getAssignment(playerId);
    if (existing) {
        const game = await getGameRecord(existing.gameId);
        if (!game) {
            await removeAssignment(playerId);
        } else {
            return respond(200, {
                status: 'already-playing',
                gameId: existing.gameId,
                color: existing.color,
                fen: game.fen,
            } satisfies QueueActionResponse);
        }
    }

    const waiting = await claimWaitingPlayer(playerId);
    if (!waiting) {
        return respond(200, { status: 'waiting' } satisfies QueueActionResponse);
    }

    const gameId = randomUUID();
    const chess = new Chess();
    const fen = chess.fen();

    const record: GameRecord = {
        id: gameId,
        fen,
        players: { white: waiting, black: playerId },
        lastUpdated: Date.now(),
        status: 'active',
    };

    await saveGameRecord(record);
    await setAssignment(waiting, { gameId, color: 'white' });
    await setAssignment(playerId, { gameId, color: 'black' });

    try {
        await triggerGameStart(waiting, { status: 'matched', gameId, color: 'white', fen });
    } catch (error) {
        console.error('Failed to notify waiting player about match', error);
        await removeGameRecord(gameId);
        await setWaitingPlayer(waiting);
        return respond(500, { error: 'Failed to notify opponent' });
    }

    return respond(200, { status: 'matched', gameId, color: 'black', fen } satisfies QueueActionResponse);
};

const handleMove = async (playerId: string, move: MoveAction): Promise<NetlifyResponse> => {
    const assignment = await getAssignment(playerId);
    if (!assignment) {
        return respond(400, { error: 'Player is not assigned to a game' });
    }

    const game = await getGameRecord(assignment.gameId);
    if (!game || game.status !== 'active') {
        return respond(400, { error: 'Game is no longer active' });
    }

    const chess = new Chess(game.fen);
    const expectedColor: PlayerColor = chess.turn() === 'w' ? 'white' : 'black';
    if (assignment.color !== expectedColor) {
        return respond(400, { error: 'Not your turn' });
    }

    const result = (() => {
        try {
            return chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
        } catch (_error) {
            return null;
        }
    })();

    if (!result) {
        return respond(400, { error: 'Illegal move' });
    }

    const updatedFen = chess.fen();
    await updateGameFen(game.id, updatedFen);

    const payload = {
        playerId,
        move: {
            from: move.from,
            to: move.to,
            promotion: result.promotion ?? undefined,
            captured: result.captured ?? undefined,
        },
        fen: updatedFen,
        turn: chess.turn(),
        check: chess.isCheck(),
    };

    try {
        await getServerPusher().trigger(`private-game-${game.id}`, MOVE, payload);
    } catch (error) {
        console.error('Failed to broadcast move', error);
        return respond(500, { error: 'Failed to broadcast move' });
    }

    if (chess.isGameOver()) {
        const winner: PlayerColor | null = chess.isCheckmate() ? assignment.color : null;
        const reason = chess.isCheckmate()
            ? 'checkmate'
            : chess.isDraw()
              ? 'draw'
              : chess.isStalemate()
                ? 'stalemate'
                : chess.isThreefoldRepetition()
                  ? 'threefold'
                  : chess.isInsufficientMaterial()
                    ? 'insufficient-material'
                    : 'unknown';

        if (game) {
            game.status = 'finished';
            await saveGameRecord(game);
        }
        try {
            await getServerPusher().trigger(`private-game-${game.id}`, GAME_OVER, { winner, reason, fen: updatedFen });
        } catch (error) {
            console.error('Failed to broadcast game over', error);
        }
        await removeGameRecord(game.id);
    }

    return respond(200, { ok: true });
};

const handleLeave = async (playerId: string): Promise<NetlifyResponse> => {
    await clearWaitingPlayer(playerId);

    const assignment = await getAssignment(playerId);
    if (!assignment) {
        return respond(200, { status: 'ok' });
    }

    const game = await getGameRecord(assignment.gameId);
    if (game) {
        const opponentId = getOpponentId(game, assignment.color);
        try {
            await getServerPusher().trigger(`private-game-${game.id}`, OPPONENT_LEFT, { playerId, opponentId });
        } catch (error) {
            console.error('Failed to notify opponent about disconnect', error);
        }
        await removeGameRecord(game.id);
    }

    return respond(200, { status: 'left' });
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
    if (event.httpMethod === 'OPTIONS') {
        return textResponse(200, 'OK');
    }

    if (event.httpMethod !== 'POST') {
        return respond(405, { error: 'Method not allowed' });
    }

    const contentType = event.headers['content-type'] ?? event.headers['Content-Type'];
    let body: RequestBody = {};
    try {
        body =
            contentType?.includes('application/json') && event.body
                ? JSON.parse(event.body)
                : event.body
                  ? (Object.fromEntries(new URLSearchParams(event.body)) as RequestBody)
                  : {};
    } catch (error) {
        console.error('Failed to parse move payload', error);
        return respond(400, { error: 'Invalid request body' });
    }

    const action = body.action;
    const playerId = body.playerId;

    if (!action || !playerId) {
        return respond(400, { error: 'Missing action or playerId' });
    }

    switch (action) {
        case 'queue':
            return handleQueue(playerId);
        case 'move':
            if (!body.move?.from || !body.move?.to) {
                return respond(400, { error: 'Invalid move payload' });
            }
            return handleMove(playerId, body.move);
        case 'leave':
            return handleLeave(playerId);
        default:
            return respond(400, { error: 'Unsupported action' });
    }
};
