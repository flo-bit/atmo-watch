import { runIngestion } from '$lib/server/contrail/cron';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const secret = platform?.env.CRON_SECRET;
	if (!secret || request.headers.get('X-Cron-Secret') !== secret) {
		return new Response('Unauthorized', { status: 401 });
	}
	if (!platform?.env.DB) return new Response('Database unavailable', { status: 503 });
	try {
		await runIngestion(platform.env.DB);
		return new Response('OK');
	} catch {
		return new Response('Ingestion failed; check Worker logs', { status: 503 });
	}
};
