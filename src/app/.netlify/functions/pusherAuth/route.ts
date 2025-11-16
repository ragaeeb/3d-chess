import { handler as netlifyAuthHandler } from 'netlify/functions/pusherAuth';
import { createNetlifyBridge } from '../utils/bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handleRequest = createNetlifyBridge(netlifyAuthHandler);

export async function OPTIONS(request: Request) {
    return handleRequest(request);
}

export async function POST(request: Request) {
    return handleRequest(request);
}
