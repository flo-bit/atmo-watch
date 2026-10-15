import { createWorker } from '@atmo-dev/contrail/worker';
import { lexicons } from '../lexicons/generated';
import { config } from './contrail.config';
import { ingestionHealthResponse } from './ingestion-health';

type Env = { DB: D1Database };

const worker = createWorker<Env>(config, {
	lexicons,
	publicService: {
		endpoint: 'https://api.atmo.watch'
	}
});

export default {
	...worker,
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const path = new URL(request.url).pathname;
		if (path === '/health/ingestion') return ingestionHealthResponse(env.DB);

		const response = await worker.fetch(request, env, ctx);
		if (path !== '/status' || !response.ok) return response;

		// Contrail 0.22's status reports null freshness for sequence cursors and
		// can say "ok" even when every scheduled ingestion attempt is failing.
		const health = await ingestionHealthResponse(env.DB);
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
	}
};
