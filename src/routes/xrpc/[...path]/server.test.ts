import { beforeEach, describe, expect, it, vi } from 'vitest';
const handle = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/contrail/runtime', () => ({ handleContrailRequest: handle }));
import * as route from './+server';

beforeEach(() => {
	handle.mockReset();
});

describe('public embedded XRPC', () => {
	it('exposes reads and CORS preflight, but no public write handler', async () => {
		const request = new Request('https://atmo.watch/xrpc/watch.atmo.video.listRecords');
		const db = {} as D1Database;
		handle.mockResolvedValue(Response.json({ records: [] }));
		const response = await route.GET({ request, platform: { env: { DB: db } } } as Parameters<
			typeof route.GET
		>[0]);
		expect(handle).toHaveBeenCalledWith(request, db);
		expect(await response.json()).toEqual({ records: [] });
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect('POST' in route).toBe(false);
		const preflight = await route.OPTIONS({} as Parameters<typeof route.OPTIONS>[0]);
		expect(preflight.status).toBe(204);
		expect(preflight.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
	});

	it('fails closed when local storage is not configured', async () => {
		expect((await route.GET({} as Parameters<typeof route.GET>[0])).status).toBe(503);
		expect(handle).not.toHaveBeenCalled();
	});
});
