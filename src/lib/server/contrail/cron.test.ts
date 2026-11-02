import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { init, ingest, retryBackfill } = vi.hoisted(() => ({
	init: vi.fn(),
	ingest: vi.fn(),
	retryBackfill: vi.fn()
}));
vi.mock('./runtime', () => ({ ensureInit: init }));
import { runIngestion } from './cron';

beforeEach(() => {
	vi.resetAllMocks();
	init.mockResolvedValue({ ingest, retryBackfill });
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('embedded scheduled ingestion', () => {
	it('bounds ingestion and retries backfill against the same binding', async () => {
		const db = {} as D1Database;
		await runIngestion(db);
		expect(init).toHaveBeenCalledWith(db);
		expect(ingest).toHaveBeenCalledWith({ maxDrainMs: 20_000, maxCandidates: 250 }, db);
		expect(retryBackfill).toHaveBeenCalledWith({ maxAccounts: 5 }, db);
	});

	it('runs retry maintenance but propagates ingestion failures', async () => {
		const error = new Error('source continuity lost');
		ingest.mockRejectedValue(error);
		await expect(runIngestion({} as D1Database)).rejects.toBe(error);
		expect(retryBackfill).toHaveBeenCalledOnce();
		expect(console.error).toHaveBeenCalledWith('[cron] ingest cycle failed:', error);
	});

	it('also propagates non-Error rejections and retry failures', async () => {
		ingest.mockRejectedValueOnce(undefined);
		await expect(runIngestion({} as D1Database)).rejects.toBeUndefined();
		retryBackfill.mockRejectedValueOnce(new Error('retry failed'));
		await expect(runIngestion({} as D1Database)).rejects.toThrow('retry failed');
	});
});
