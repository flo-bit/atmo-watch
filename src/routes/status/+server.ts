import { handleContrailRequest } from '$lib/server/contrail/runtime';
import { ingestionHealthResponse } from '$lib/server/contrail/ingestion-health';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env.DB) return new Response('Database unavailable', { status: 503 });
	const db = platform.env.DB;
	const response = await handleContrailRequest(request, db);
	if (!response.ok) return response;
	const health = await ingestionHealthResponse(db);
	const status = (await response.json()) as Record<string, unknown>;
	const headers = new Headers(response.headers);
	headers.set('Cache-Control', 'no-store');
	headers.delete('Content-Length');
	return Response.json(
		{
			...status,
			status: health.ok ? status.status : 'degraded',
			ingestion: await health.json()
		},
		{ status: response.status, headers }
	);
};
