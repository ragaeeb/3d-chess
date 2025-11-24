const PLAYER_ID_STORAGE_KEY = 'chessie:playerId';

const isBrowser = () => typeof window !== 'undefined';

export const readStoredPlayerId = (): string | null => {
    if (!isBrowser()) {
        return null;
    }

    try {
        return window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to read player id from storage', error);
        return null;
    }
};

export const persistPlayerId = (playerId: string): string => {
    if (isBrowser()) {
        try {
            window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);
        } catch (error) {
            console.warn('Failed to persist player id', error);
        }
    }

    return playerId;
};

const generateUUID = (): string => {
    // Try using crypto.randomUUID if available
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback for older browsers (including iOS Safari < 15.4)
    // This follows the UUID v4 format
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

export const ensurePlayerId = (): string => {
    const existing = readStoredPlayerId();
    if (existing) {
        return existing;
    }

    const id = generateUUID();
    return persistPlayerId(id);
};
