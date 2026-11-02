import { beforeEach, describe, expect, it, vi } from 'vitest';
const handle = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/contrail/runtime', () => ({ handleContrailRequest: handle }));
import { GET } from './+server';

function invoke(updatedAt: number | null) {
	return GET({
		request: new Request('https://atmo.watch/status'),
		platform: {
			env: {
				DB: {
					prepare: () => ({
						first: async () => (updatedAt === null ? null : { updated_at: updatedAt })
					})
				}
			}
		}
	} as unknown as Parameters<typeof GET>[0]);
}

beforeEach(() => {
	handle.mockReset();
});

describe('embedded ingestion health status', () => {
	it('marks stale ingestion degraded even if the AppView is still serving', async () => {
		handle.mockResolvedValue(
			Response.json(
				{ status: 'ok', serving: 'ready', total_records: 123 },
				{ headers: { 'Content-Length': '10' } }
			)
		);
		const response = await invoke(Date.now() - 6 * 86400000);
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

	it('preserves healthy status and upstream failures', async () => {
		handle.mockResolvedValue(Response.json({ status: 'ok' }));
		expect(await (await invoke(Date.now() - 1000)).json()).toMatchObject({
			status: 'ok',
			ingestion: { status: 'ok' }
		});
		const failure = new Response('Unavailable', { status: 503 });
		handle.mockResolvedValue(failure);
		expect(await invoke(null)).toBe(failure);
	});
});
