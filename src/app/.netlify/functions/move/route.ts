import { handler as netlifyMoveHandler } from 'netlify/functions/move';
import { createNetlifyBridge } from '../utils/bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handleRequest = createNetlifyBridge(netlifyMoveHandler);

export async function OPTIONS(request: Request) {
    return handleRequest(request);
}

export async function POST(request: Request) {
    return handleRequest(request);
}
