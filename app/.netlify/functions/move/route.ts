import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { handler as NetlifyHandler } from '../../../../netlify/functions/move';
import { handler as netlifyMoveHandler } from '../../../../netlify/functions/move';

type NetlifyEvent = Parameters<NetlifyHandler>[0];
type NetlifyResult = Awaited<ReturnType<NetlifyHandler>>;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const toNetlifyHeaders = (request: NextRequest) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        headers[key] = value;
    });
    return headers;
};

const toNetlifyEvent = async (request: NextRequest): Promise<NetlifyEvent> => ({
    httpMethod: request.method,
    headers: toNetlifyHeaders(request),
    body: request.method === 'GET' ? null : await request.text(),
});

const toNextResponse = (result: NetlifyResult) =>
    new NextResponse(result.body, { status: result.statusCode, headers: result.headers });

export async function OPTIONS(request: NextRequest) {
    const result = await netlifyMoveHandler(await toNetlifyEvent(request));
    return toNextResponse(result);
}

export async function POST(request: NextRequest) {
    const result = await netlifyMoveHandler(await toNetlifyEvent(request));
    return toNextResponse(result);
}
