import { beforeEach, describe, expect, it, vi } from 'vitest';

const delegate = vi.hoisted(() => ({ fetch: vi.fn(), scheduled: vi.fn() }));
vi.mock('@atmo-dev/contrail/worker', () => ({ createWorker: () => delegate }));
vi.mock('./contrail.config', () => ({ config: {} }));
vi.mock('../lexicons/generated', () => ({ lexicons: [] }));

import worker from './worker';

const ctx = {} as ExecutionContext;
function env(updatedAt: number | null) {
	return {
		DB: {
			prepare: vi.fn(() => ({
				first: vi.fn().mockResolvedValue(updatedAt === null ? null : { updated_at: updatedAt })
			}))
		} as unknown as D1Database
	};
}

beforeEach(() => {
	delegate.fetch.mockReset();
});

describe('API health routing', () => {
	it('leaves XRPC responses and scheduled ingestion unchanged', async () => {
		const response = new Response('untouched');
		delegate.fetch.mockResolvedValue(response);
		const bindings = env(null);
		expect(
			await worker.fetch(
				new Request('https://api.atmo.watch/xrpc/watch.atmo.getCursor'),
				bindings,
				ctx
			)
		).toBe(response);
		expect(bindings.DB.prepare).not.toHaveBeenCalled();
		expect(worker.scheduled).toBe(delegate.scheduled);
	});

	it('serves a dedicated 503 ingestion check without a full status scan', async () => {
		const response = await worker.fetch(
			new Request('https://api.atmo.watch/health/ingestion'),
			env(null),
			ctx
		);
		expect(response.status).toBe(503);
		expect(delegate.fetch).not.toHaveBeenCalled();
	});

	it('does not report an expired ingestion checkpoint as healthy', async () => {
		delegate.fetch.mockResolvedValue(
			Response.json(
				{ status: 'ok', serving: 'ready', total_records: 123 },
				{
					headers: { 'Content-Length': '10' }
				}
			)
		);
		const response = await worker.fetch(
			new Request('https://api.atmo.watch/status'),
			env(Date.now() - 6 * 86400000),
			ctx
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(response.headers.has('Content-Length')).toBe(false);
		expect(await response.json()).toMatchObject({
			status: 'degraded',
			serving: 'ready',
			total_records: 123,
			ingestion: { status: 'stale' }
		});
	});

	it('preserves a healthy status and upstream failures', async () => {
		delegate.fetch.mockResolvedValue(Response.json({ status: 'ok' }));
		const response = await worker.fetch(
			new Request('https://api.atmo.watch/status'),
			env(Date.now() - 1000),
			ctx
		);
		expect(await response.json()).toMatchObject({ status: 'ok', ingestion: { status: 'ok' } });
		const failure = new Response('unavailable', { status: 503 });
		delegate.fetch.mockResolvedValue(failure);
		expect(await worker.fetch(new Request('https://api.atmo.watch/status'), env(null), ctx)).toBe(
			failure
		);
	});
});
