import { getEnvVar } from "./env";

const getConfig = () => {
  const url = getEnvVar("UPSTASH_REDIS_REST_URL");
  const token = getEnvVar("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token) {
    throw new Error("Upstash Redis environment variables are not configured");
  }

  return { url, token };
};

const encodeKey = (key: string) => encodeURIComponent(key);

const request = async <T>(path: string, init: RequestInit = {}): Promise<{ result?: T; error?: string }> => {
  const { url, token } = getConfig();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Upstash request failed: ${response.status} ${message}`);
  }

  return (await response.json()) as { result?: T; error?: string };
};

export const redisGetString = async (key: string): Promise<string | null> => {
  const { result } = await request<string | null>(`/get/${encodeKey(key)}`);
  return typeof result === "string" ? result : null;
};

export const redisSetString = async (
  key: string,
  value: string,
  options: { ex?: number } = {},
): Promise<void> => {
  await request(`/set/${encodeKey(key)}`, {
    method: "POST",
    body: JSON.stringify({ value, ...options }),
  });
};

export const redisSetIfAbsent = async (
  key: string,
  value: string,
  options: { ex?: number } = {},
): Promise<boolean> => {
  const { result } = await request<string | null>(`/set/${encodeKey(key)}`, {
    method: "POST",
    body: JSON.stringify({ value, nx: true, ...options }),
  });

  return result === "OK";
};

export const redisGetJson = async <T>(key: string): Promise<T | null> => {
  const raw = await redisGetString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Failed to parse JSON for key ${key}`, error);
    return null;
  }
};

export const redisSetJson = async <T>(
  key: string,
  value: T,
  options: { ex?: number } = {},
): Promise<void> => {
  await redisSetString(key, JSON.stringify(value), options);
};

export const redisDel = async (...keys: string[]): Promise<void> => {
  if (keys.length === 0) {
    return;
  }

  await request(`/del/${keys.map(encodeKey).join("/")}`, {
    method: "POST",
  });
};
