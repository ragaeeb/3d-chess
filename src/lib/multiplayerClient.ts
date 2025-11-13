const normalizeBaseUrl = (value: string | undefined) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    return url.origin + (url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname);
  } catch {
    return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  }
};

const MULTIPLAYER_BASE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_MULTIPLAYER_BASE_URL);

const buildUrl = (path: string, params?: Record<string, string | undefined | null>) => {
  const urlBase = MULTIPLAYER_BASE_URL;
  if (urlBase) {
    if (urlBase.startsWith("http://") || urlBase.startsWith("https://")) {
      const url = new URL(path, urlBase);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, value);
          }
        });
      }
      return url.toString();
    }

    const relativePath = urlBase + (path.startsWith("/") ? path : `/${path}`);
    if (!params) {
      return relativePath;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, value);
      }
    });

    const query = searchParams.toString();
    return query ? `${relativePath}?${query}` : relativePath;
  }

  if (!params) {
    return path;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
};

export const openMultiplayerStream = (playerId: string) => {
  const url = buildUrl("/api/game/stream", { playerId });
  return new EventSource(url);
};

export const joinMultiplayerQueue = async (playerId: string) => {
  const response = await fetch(buildUrl("/api/game/join"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ status: string }>;
};

export const submitMultiplayerMove = async (
  playerId: string,
  move: { from: string; to: string },
) => {
  const response = await fetch(buildUrl("/api/game/move"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, move }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
};
