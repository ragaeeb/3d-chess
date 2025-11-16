import { NextResponse } from 'next/server';

type NetlifyEvent = { httpMethod: string; headers: Record<string, string>; body: string | null };

type NetlifyHandler = (
    event: NetlifyEvent,
) => Promise<{ statusCode: number; headers?: Record<string, string>; body: string }>;

const toNetlifyHeaders = (request: Request) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        headers[key] = value;
    });
    return headers;
};

const toNetlifyEvent = async (request: Request): Promise<NetlifyEvent> => ({
    httpMethod: request.method,
    headers: toNetlifyHeaders(request),
    body: request.method === 'GET' ? null : await request.text().catch(() => null),
});

const toNextResponse = (result: Awaited<ReturnType<NetlifyHandler>>) =>
    new NextResponse(result.body, { status: result.statusCode, headers: result.headers });

export const createNetlifyBridge = (handler: NetlifyHandler) => {
    return async (request: Request) => {
        const result = await handler(await toNetlifyEvent(request));
        return toNextResponse(result);
    };
};
