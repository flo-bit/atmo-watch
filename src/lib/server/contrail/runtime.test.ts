import { afterEach, describe, expect, it, vi } from 'vitest';
import { Contrail } from '@atmo-dev/contrail';
import { ensureInit, handleContrailRequest } from './runtime';

afterEach(() => vi.restoreAllMocks());

describe('embedded Contrail lifecycle', () => {
	it('shares concurrent initialization for one DB, but initializes other bindings separately', async () => {
		const init = vi.spyOn(Contrail.prototype, 'init').mockResolvedValue(undefined);
		const db = {} as D1Database;
		const [first, second] = await Promise.all([ensureInit(db), ensureInit(db)]);
		expect(first).toBe(second);
		expect(init).toHaveBeenCalledTimes(1);
		expect(init).toHaveBeenCalledWith(db, { deferModerationPolicyJob: true });
		expect(await ensureInit({} as D1Database)).not.toBe(first);
		expect(init).toHaveBeenCalledTimes(2);
	});

	it('retries initialization after failure instead of poisoning the isolate', async () => {
		const init = vi
			.spyOn(Contrail.prototype, 'init')
			.mockRejectedValueOnce(new Error('D1 unavailable'))
			.mockResolvedValue(undefined);
		const db = {} as D1Database;
		await expect(ensureInit(db)).rejects.toThrow('D1 unavailable');
		await expect(ensureInit(db)).resolves.toBeInstanceOf(Contrail);
		expect(init).toHaveBeenCalledTimes(2);
	});

	it('passes the current request binding and bundled lexicons to the handler', async () => {
		vi.spyOn(Contrail.prototype, 'init').mockResolvedValue(undefined);
		const response = Response.json({ records: [] });
		const delegate = vi.fn().mockResolvedValue(response);
		const handler = vi.spyOn(Contrail.prototype, 'handler').mockReturnValue(delegate);
		const request = new Request('https://atmo.watch/xrpc/watch.atmo.video.listRecords');
		const db = {} as D1Database;
		expect(await handleContrailRequest(request, db)).toBe(response);
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({ db, lexicons: expect.any(Array) })
		);
		expect(delegate).toHaveBeenCalledWith(request);
	});
});
