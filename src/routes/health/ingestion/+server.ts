import { ingestionHealthResponse } from '$lib/server/contrail/ingestion-health';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ platform }) => {
	if (!platform?.env.DB) return new Response('Database unavailable', { status: 503 });
	return ingestionHealthResponse(platform.env.DB);
};
