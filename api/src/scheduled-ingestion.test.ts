import { Contrail, type ContrailConfig } from '@atmo-dev/contrail';
import { createWorker } from '@atmo-dev/contrail/worker';
import { afterEach, describe, expect, it, vi } from 'vitest';

const config: ContrailConfig = {
	namespace: 'watch.atmo',
	collections: { review: { collection: 'social.popfeed.feed.review' } }
};

async function scheduled(error?: unknown) {
	const ingest = vi.spyOn(Contrail.prototype, 'ingest');
	vi.spyOn(Contrail.prototype, 'init').mockResolvedValue(undefined);
	const retry = vi.spyOn(Contrail.prototype, 'retryBackfill').mockResolvedValue(undefined as never);
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	if (arguments.length > 0) ingest.mockRejectedValue(error);
	else ingest.mockResolvedValue(undefined);
	const worker = createWorker(config);
	const pending: Promise<unknown>[] = [];
	await worker.scheduled({} as ScheduledEvent, { DB: {} as D1Database }, {
		waitUntil: (promise: Promise<unknown>) => pending.push(promise)
	} as unknown as ExecutionContext);
	return { pending, retry, log };
}

afterEach(() => vi.restoreAllMocks());

describe('patched scheduled ingestion failure reporting', () => {
	it('logs without a custom logger and rejects waitUntil after running retry maintenance', async () => {
		const failure = Object.assign(new Error('source continuity lost'), {
			name: 'JetstreamFutureCursorError'
		});
		const { pending, retry, log } = await scheduled(failure);
		await expect(Promise.all(pending)).rejects.toBe(failure);
		expect(retry).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(expect.stringContaining('JetstreamFutureCursorError'));
	});

	it('also propagates a non-Error rejection', async () => {
		const { pending } = await scheduled(undefined);
		await expect(Promise.all(pending)).rejects.toBeUndefined();
	});

	it('keeps a successful cron successful', async () => {
		const { pending, retry, log } = await scheduled();
		await expect(Promise.all(pending)).resolves.toEqual([undefined]);
		expect(retry).toHaveBeenCalledTimes(1);
		expect(log).not.toHaveBeenCalled();
	});
});
