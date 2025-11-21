import { Redis } from '@upstash/redis';

export type PlayerColor = 'white' | 'black';

export type GameRecord = {
    id: string;
    fen: string;
    players: { white: string | null; black: string | null };
    spectators: string[];
    lastUpdated: number;
    status: 'waiting' | 'active' | 'finished';
};

export type PlayerAssignment = { gameId: string; color: PlayerColor };

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const WAITING_KEY = 'chessie:waiting-player';
const ASSIGNMENT_PREFIX = 'chessie:assignment:';
const assignmentKey = (playerId: string) => `${ASSIGNMENT_PREFIX}${playerId}`;
const gameKey = (gameId: string) => `chessie:game:${gameId}`;

const GAME_TTL_SECONDS = 60 * 60 * 24; // 24h safeguard
const STALE_MEMORY_WINDOW_MS = GAME_TTL_SECONDS * 1000;
const MEMORY_CLEANUP_INTERVAL_MS = 60 * 1000;

type MemoryStore = {
    waitingPlayer: string | null;
    games: Map<string, GameRecord>;
    assignments: Map<string, PlayerAssignment>;
};

type GlobalWithStore = typeof globalThis & { __memoryGameStore?: MemoryStore };
type ProcessWithStore = NodeJS.Process & { __memoryGameStore?: MemoryStore };

const resolveMemoryStore = (): MemoryStore => {
    const globalWithStore = globalThis as GlobalWithStore;
    const processWithStore = typeof process !== 'undefined' ? (process as ProcessWithStore) : undefined;

    if (processWithStore?.__memoryGameStore) {
        if (!globalWithStore.__memoryGameStore) {
            globalWithStore.__memoryGameStore = processWithStore.__memoryGameStore;
        }
        return processWithStore.__memoryGameStore;
    }

    if (!globalWithStore.__memoryGameStore) {
        globalWithStore.__memoryGameStore = {
            waitingPlayer: null,
            games: new Map<string, GameRecord>(),
            assignments: new Map<string, PlayerAssignment>(),
        } satisfies MemoryStore;
        if (processWithStore) {
            processWithStore.__memoryGameStore = globalWithStore.__memoryGameStore;
        }
    }

    return globalWithStore.__memoryGameStore;
};

const memoryStore = resolveMemoryStore();
let lastMemoryCleanup = 0;

const cleanupMemoryStore = () => {
    const now = Date.now();
    if (now - lastMemoryCleanup < MEMORY_CLEANUP_INTERVAL_MS) {
        return;
    }
    lastMemoryCleanup = now;

    for (const [gameId, record] of memoryStore.games.entries()) {
        if (now - record.lastUpdated > STALE_MEMORY_WINDOW_MS) {
            memoryStore.games.delete(gameId);
            if (record.players.white) {
                memoryStore.assignments.delete(record.players.white);
            }
            if (record.players.black) {
                memoryStore.assignments.delete(record.players.black);
            }
        }
    }
};

const serialize = (value: unknown) => JSON.stringify(value);

const parseStoredValue = <T>(value: unknown): T | null => {
    if (value == null || value === '') {
        return null;
    }

    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch (error) {
            console.error('Failed to parse stored value', error);
            return null;
        }
    }

    return value as T;
};

const EMPTY_VALUE = '';

const CLAIM_WAITING_LUA = `
local current = redis.call('GET', KEYS[1])
if (not current) or current == '' then
  redis.call('SET', KEYS[1], ARGV[1])
  return ''
end
-- When the same player re-queues we keep them in place and return an empty string for idempotency.
if current == ARGV[1] then
  return ''
end
redis.call('DEL', KEYS[1])
return current
`;

const CLEAR_WAITING_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1])
end
return 1
`;

const UPDATE_FEN_LUA = `
local record = redis.call('GET', KEYS[1])
if not record then
  return 0
end
local decoded = cjson.decode(record)
decoded.fen = ARGV[1]
decoded.lastUpdated = tonumber(ARGV[2])
redis.call('SET', KEYS[1], cjson.encode(decoded), 'EX', ARGV[3])
return 1
`;

const JOIN_GAME_LUA = `
local gameKey = KEYS[1]
local playerId = ARGV[1]
local lastUpdated = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local record = redis.call('GET', gameKey)
if not record then
  return cjson.encode({ status = 'not_found' })
end

local decoded = cjson.decode(record)

if decoded.players and decoded.players.white == playerId then
  return cjson.encode({ status = 'existing', color = 'white' })
end

if decoded.players and decoded.players.black == playerId then
  return cjson.encode({ status = 'existing', color = 'black' })
end

decoded.spectators = decoded.spectators or {}

if decoded.status == 'active' or (decoded.players.black and decoded.players.white) then
  local already = false
  for _, id in ipairs(decoded.spectators) do
    if id == playerId then
      already = true
      break
    end
  end

  if not already then
    table.insert(decoded.spectators, playerId)
    redis.call('SET', gameKey, cjson.encode(decoded), 'EX', ttl)
  end

  return cjson.encode({ status = 'spectator' })
end

if not decoded.players.white then
  decoded.players.white = playerId
  decoded.status = 'active'
  decoded.lastUpdated = lastUpdated
  redis.call('SET', gameKey, cjson.encode(decoded), 'EX', ttl)
  return cjson.encode({ status = 'white' })
end

decoded.players.black = playerId
decoded.status = 'active'
decoded.lastUpdated = lastUpdated

redis.call('SET', gameKey, cjson.encode(decoded), 'EX', ttl)
return cjson.encode({ status = 'black' })
`;

const ENSURE_GAME_LUA = `
local existing = redis.call('GET', KEYS[1])
if existing then
  return existing
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return ARGV[1]
`;

const REMOVE_GAME_LUA = `
local record = redis.call('GET', KEYS[1])
if not record then
  return nil
end
redis.call('DEL', KEYS[1])
local decoded = cjson.decode(record)
if decoded and decoded.players then
  if decoded.players.white then
    redis.call('DEL', ARGV[1] .. decoded.players.white)
  end
  if decoded.players.black then
    redis.call('DEL', ARGV[1] .. decoded.players.black)
  end
end
return record
`;

const handleRedisError = (context: string, error: unknown) => {
    console.error(`Redis operation failed (${context})`, error);
};

export const isRedisBacked = Boolean(redis);

export type JoinGameDecision =
    | { status: 'not_found' | 'spectator' | 'black' | 'white' }
    | { status: 'existing'; color: PlayerColor };

export const joinGameAtomically = async (gameId: string, playerId: string): Promise<JoinGameDecision | null> => {
    cleanupMemoryStore();
    if (!redis) {
        return null;
    }
    try {
        const result = await redis.eval(
            JOIN_GAME_LUA,
            [gameKey(gameId)],
            [playerId, Date.now().toString(), GAME_TTL_SECONDS.toString()],
        );
        return parseStoredValue<JoinGameDecision>(result);
    } catch (error) {
        handleRedisError('joinGameAtomically', error);
        return null;
    }
};

const memoryClaimWaitingPlayer = (playerId: string): string | null => {
    cleanupMemoryStore();
    const waiting = memoryStore.waitingPlayer;
    if (!waiting || waiting === playerId) {
        memoryStore.waitingPlayer = playerId;
        return null;
    }
    memoryStore.waitingPlayer = null;
    return waiting;
};

export const claimWaitingPlayer = async (playerId: string): Promise<string | null> => {
    if (!redis) {
        return memoryClaimWaitingPlayer(playerId);
    }
    try {
        const result = (await redis.eval(CLAIM_WAITING_LUA, [WAITING_KEY], [playerId])) as string | null;
        if (!result || result === EMPTY_VALUE) {
            return null;
        }
        return result;
    } catch (error) {
        handleRedisError('claimWaitingPlayer', error);
        return memoryClaimWaitingPlayer(playerId);
    }
};

export const setWaitingPlayer = async (playerId: string | null) => {
    cleanupMemoryStore();
    if (!redis) {
        memoryStore.waitingPlayer = playerId;
        return;
    }
    try {
        if (!playerId) {
            await redis.del(WAITING_KEY);
        } else {
            await redis.set(WAITING_KEY, playerId);
        }
    } catch (error) {
        handleRedisError('setWaitingPlayer', error);
        memoryStore.waitingPlayer = playerId;
    }
};

export const clearWaitingPlayer = async (playerId: string) => {
    cleanupMemoryStore();
    if (!redis) {
        if (memoryStore.waitingPlayer === playerId) {
            memoryStore.waitingPlayer = null;
        }
        return;
    }
    try {
        await redis.eval(CLEAR_WAITING_LUA, [WAITING_KEY], [playerId]);
    } catch (error) {
        handleRedisError('clearWaitingPlayer', error);
        if (memoryStore.waitingPlayer === playerId) {
            memoryStore.waitingPlayer = null;
        }
    }
};

export const getAssignment = async (playerId: string): Promise<PlayerAssignment | null> => {
    cleanupMemoryStore();
    if (!redis) {
        return memoryStore.assignments.get(playerId) ?? null;
    }
    try {
        const value = await redis.get<PlayerAssignment | string>(assignmentKey(playerId));
        return parseStoredValue<PlayerAssignment>(value);
    } catch (error) {
        handleRedisError('getAssignment', error);
        return memoryStore.assignments.get(playerId) ?? null;
    }
};

export const setAssignment = async (playerId: string, assignment: PlayerAssignment) => {
    cleanupMemoryStore();
    if (!redis) {
        memoryStore.assignments.set(playerId, assignment);
        return;
    }
    try {
        await redis.set(assignmentKey(playerId), serialize(assignment), { ex: GAME_TTL_SECONDS });
    } catch (error) {
        handleRedisError('setAssignment', error);
        memoryStore.assignments.set(playerId, assignment);
    }
};

export const removeAssignment = async (playerId: string) => {
    cleanupMemoryStore();
    if (!redis) {
        memoryStore.assignments.delete(playerId);
        return;
    }
    try {
        await redis.del(assignmentKey(playerId));
    } catch (error) {
        handleRedisError('removeAssignment', error);
        memoryStore.assignments.delete(playerId);
    }
};

export const getGameRecord = async (gameId: string): Promise<GameRecord | null> => {
    cleanupMemoryStore();
    if (!redis) {
        return memoryStore.games.get(gameId) ?? null;
    }
    try {
        const value = await redis.get<GameRecord | string>(gameKey(gameId));
        return parseStoredValue<GameRecord>(value);
    } catch (error) {
        handleRedisError('getGameRecord', error);
        return memoryStore.games.get(gameId) ?? null;
    }
};

export const saveGameRecord = async (record: GameRecord) => {
    cleanupMemoryStore();
    if (!redis) {
        memoryStore.games.set(record.id, record);
        return;
    }
    try {
        await redis.set(gameKey(record.id), serialize(record), { ex: GAME_TTL_SECONDS });
    } catch (error) {
        handleRedisError('saveGameRecord', error);
        memoryStore.games.set(record.id, record);
    }
};

export const updateGameFen = async (gameId: string, fen: string) => {
    cleanupMemoryStore();
    if (!redis) {
        const record = memoryStore.games.get(gameId);
        if (!record) {
            return;
        }
        record.fen = fen;
        record.lastUpdated = Date.now();
        memoryStore.games.set(gameId, record);
        return;
    }
    try {
        await redis.eval(UPDATE_FEN_LUA, [gameKey(gameId)], [fen, Date.now().toString(), GAME_TTL_SECONDS.toString()]);
    } catch (error) {
        handleRedisError('updateGameFen', error);
        const record = memoryStore.games.get(gameId);
        if (!record) {
            return;
        }
        record.fen = fen;
        record.lastUpdated = Date.now();
        memoryStore.games.set(gameId, record);
    }
};

const removeGameFromMemory = (gameId: string) => {
    const record = memoryStore.games.get(gameId);
    if (!record) {
        return;
    }
    memoryStore.games.delete(gameId);
    if (record.players.white) {
        memoryStore.assignments.delete(record.players.white);
    }
    if (record.players.black) {
        memoryStore.assignments.delete(record.players.black);
    }
};

export const removeGameRecord = async (gameId: string) => {
    cleanupMemoryStore();
    if (!redis) {
        removeGameFromMemory(gameId);
        return;
    }
    try {
        await redis.eval(REMOVE_GAME_LUA, [gameKey(gameId)], [ASSIGNMENT_PREFIX]);
    } catch (error) {
        handleRedisError('removeGameRecord', error);
        removeGameFromMemory(gameId);
    }
};

export const ensureGameRecord = async (gameId: string, create: () => GameRecord): Promise<GameRecord> => {
    cleanupMemoryStore();
    const memoryEnsure = () => {
        const existing = memoryStore.games.get(gameId);
        if (existing) {
            return existing;
        }
        const next = create();
        memoryStore.games.set(gameId, next);
        return next;
    };

    if (!redis) {
        return memoryEnsure();
    }

    const candidate = create();
    const serialized = serialize(candidate);
    try {
        const result = await redis.eval(ENSURE_GAME_LUA, [gameKey(gameId)], [serialized, GAME_TTL_SECONDS.toString()]);
        return parseStoredValue<GameRecord>(result) ?? candidate;
    } catch (error) {
        handleRedisError('ensureGameRecord', error);
        return memoryEnsure();
    }
};

export const __resetMemoryStore = () => {
    memoryStore.waitingPlayer = null;
    memoryStore.games.clear();
    memoryStore.assignments.clear();
    lastMemoryCleanup = 0;
};
