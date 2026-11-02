import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@atmo-dev/contrail';
import {
	getIngestionHealth,
	ingestionHealthResponse,
	MAX_CHECKPOINT_AGE_MS
} from './ingestion-health';

const NOW = Date.parse('2026-09-23T12:00:00Z');

function database(updatedAt: unknown): Database {
	return {
		prepare: vi.fn(() => ({
			first: vi.fn().mockResolvedValue(updatedAt === null ? null : { updated_at: updatedAt })
		}))
	} as unknown as Database;
}

describe('ingestion checkpoint health', () => {
	it('uses checkpoint wall time, not a Jetstream sequence interpreted as a timestamp', async () => {
		const db = database(NOW - 60_000);
		expect(await getIngestionHealth(db, NOW)).toEqual({
			status: 'ok',
			checkpointUpdatedAt: '2026-09-23T11:59:00.000Z',
			secondsSinceCheckpoint: 60,
			maxAgeSeconds: 1800
		});
		expect(db.prepare).toHaveBeenCalledWith('SELECT updated_at FROM source_position WHERE id = 1');
	});

	it('measures age after reading a checkpoint updated during the request', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const db = {
			prepare: () => ({
				async first() {
					vi.setSystemTime(NOW + 1000);
					return { updated_at: NOW + 1000 };
				}
			})
		} as unknown as Database;
		try {
			expect(await getIngestionHealth(db)).toMatchObject({
				status: 'ok',
				secondsSinceCheckpoint: 0
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it('allows the threshold but flags older checkpoints', async () => {
		expect((await getIngestionHealth(database(NOW - MAX_CHECKPOINT_AGE_MS), NOW)).status).toBe(
			'ok'
		);
		expect((await getIngestionHealth(database(NOW - MAX_CHECKPOINT_AGE_MS - 1), NOW)).status).toBe(
			'stale'
		);
	});

	it.each([null, undefined, 0, -1, NaN, '1790164800000', NOW + 1])(
		'fails closed for a missing or invalid checkpoint: %s',
		async (updatedAt) => {
			expect(await getIngestionHealth(database(updatedAt), NOW)).toMatchObject({
				status: 'uninitialized',
				checkpointUpdatedAt: null,
				secondsSinceCheckpoint: null
			});
		}
	);

	it('returns an uncached 200 for a fresh checkpoint', async () => {
		const response = await ingestionHealthResponse(database(Date.now() - 1000));
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.json()).toMatchObject({ status: 'ok' });
	});

	it('returns an uncached 503 when stale', async () => {
		const response = await ingestionHealthResponse(
			database(Date.now() - MAX_CHECKPOINT_AGE_MS - 1000)
		);
		expect(response.status).toBe(503);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.json()).toMatchObject({ status: 'stale' });
	});

	it('returns 503 without exposing database errors', async () => {
		const db = {
			prepare() {
				throw new Error('private database details');
			}
		} as unknown as Database;
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const response = await ingestionHealthResponse(db);
			expect(response.status).toBe(503);
			expect(await response.json()).toEqual({
				status: 'error',
				message: 'Could not read ingestion checkpoint'
			});
		} finally {
			log.mockRestore();
		}
	});
});
