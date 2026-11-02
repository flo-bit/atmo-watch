import { handleContrailRequest } from '$lib/server/contrail/runtime';
import type { RequestHandler } from './$types';

const cors = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400'
};

// Public reads only. Writes go to the viewer's PDS from authenticated remote
// functions; their in-process notifications never expose a public mutation.
export const GET: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env.DB) return new Response('Database unavailable', { status: 503 });
	const response = await handleContrailRequest(request, platform.env.DB);
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(cors)) headers.set(key, value);
	return new Response(response.body, { status: response.status, headers });
};

export const OPTIONS: RequestHandler = () => new Response(null, { status: 204, headers: cors });
