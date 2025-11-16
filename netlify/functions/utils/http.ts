export type NetlifyEvent = {
    httpMethod: string;
    body: string | null;
    headers: Record<string, string | undefined>;
};

export type NetlifyResponse = {
    statusCode: number;
    headers?: Record<string, string>;
    body: string;
};

const toUrl = (value?: string) => {
    if (!value) {
        return undefined;
    }
    return value.startsWith('http') ? value : `https://${value}`;
};

const allowedOrigin =
    process.env.APP_ALLOWED_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? toUrl(process.env.NEXT_PUBLIC_VERCEL_URL) ?? '*';

const baseCorsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
} as const;

export const getCorsHeaders = (): Record<string, string> => ({ ...baseCorsHeaders });

export const textResponse = (statusCode: number, body: string): NetlifyResponse => ({
    statusCode,
    headers: getCorsHeaders(),
    body,
});

export const jsonResponse = (statusCode: number, payload: unknown): NetlifyResponse => ({
    statusCode,
    headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
});
