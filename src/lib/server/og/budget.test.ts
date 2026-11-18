import { afterEach, describe, expect, it } from 'vitest';
import { budgetPeriods, claimGeneration, LEASE_MS, releaseGeneration } from './budget';
import { testDb } from './testing';

const databases: ReturnType<typeof testDb>[] = [];
function setup(options?: Parameters<typeof testDb>[0]) {
	const result = testDb(options);
	databases.push(result);
	return result;
}
afterEach(() => {
	for (const { sqlite } of databases.splice(0)) sqlite.close();
});
const now = Date.parse('2026-11-18T12:00:00Z');
const attempts = (sqlite: ReturnType<typeof testDb>['sqlite']) =>
	sqlite.prepare('SELECT daily_attempts, cycle_attempts FROM og_generation_budget').get();

describe('atomic global generation budget', () => {
	it('deduplicates concurrent claims for the same image', async () => {
		const { db, sqlite } = setup();
		const claims = await Promise.all(
			Array.from({ length: 20 }, () => claimGeneration({ DB: db }, 'same', now))
		);
		expect(claims.filter(Boolean)).toHaveLength(1);
		expect(attempts(sqlite)?.daily_attempts).toBe(1);
	});

	it('bounds many distinct images and writes no lease for denied claims', async () => {
		const { db, sqlite } = setup();
		const env = { DB: db, OG_DAILY_GENERATION_LIMIT: '3' };
		const claims = await Promise.all(
			Array.from({ length: 40 }, (_, i) => claimGeneration(env, `image-${i}`, now))
		);
		expect(claims.filter(Boolean)).toHaveLength(3);
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM og_generation_leases').get()?.n).toBe(3);
	});

	it('keeps the last daily slots for reserved claims', async () => {
		const { db, sqlite } = setup();
		const env = {
			DB: db,
			OG_DAILY_GENERATION_LIMIT: '5',
			OG_DAILY_SOCIAL_RESERVE: '2',
			OG_CYCLE_GENERATION_LIMIT: '100'
		};
		const crawl = await Promise.all(
			Array.from({ length: 10 }, (_, i) => claimGeneration(env, `crawl-${i}`, now))
		);
		expect(crawl.filter(Boolean)).toHaveLength(3);
		const shared = await Promise.all(
			Array.from({ length: 10 }, (_, i) => claimGeneration(env, `shared-${i}`, now, true))
		);
		expect(shared.filter(Boolean)).toHaveLength(2);
		expect(attempts(sqlite)?.daily_attempts).toBe(5);
	});

	it('resets the daily counter each UTC day but enforces the cycle limit', async () => {
		const { db } = setup();
		const env = { DB: db, OG_DAILY_GENERATION_LIMIT: '1', OG_CYCLE_GENERATION_LIMIT: '2' };
		const day = 24 * 60 * 60 * 1000;
		expect(await claimGeneration(env, 'a', now)).toBeTruthy();
		expect(await claimGeneration(env, 'b', now)).toBeNull();
		expect(await claimGeneration(env, 'b', now + day)).toBeTruthy();
		expect(await claimGeneration(env, 'c', now + 2 * day)).toBeNull();
		// A new billing cycle (the 13th) starts over.
		expect(await claimGeneration(env, 'c', Date.parse('2026-12-13T00:00:00Z'))).toBeTruthy();
	});

	it('holds a failed image for the lease period, and frees it on release', async () => {
		const { db } = setup();
		const env = { DB: db, OG_DAILY_GENERATION_LIMIT: '10' };
		const token = await claimGeneration(env, 'image', now);
		expect(await claimGeneration(env, 'image', now + LEASE_MS - 1)).toBeNull();
		expect(await claimGeneration(env, 'image', now + LEASE_MS)).toBeTruthy();
		const { db: other } = setup();
		const second = await claimGeneration({ ...env, DB: other }, 'image', now);
		await releaseGeneration(other, 'image', second!);
		expect(await claimGeneration({ ...env, DB: other }, 'image', now)).toBeTruthy();
		expect(token).toBeTruthy();
	});

	it('creates its tables on first use', async () => {
		const { db, sqlite } = setup({ schema: false });
		expect(await claimGeneration({ DB: db }, 'image', now)).toBeTruthy();
		expect(attempts(sqlite)?.daily_attempts).toBe(1);
	});

	it.each([
		{ OG_DAILY_GENERATION_LIMIT: '0' },
		{ OG_DAILY_GENERATION_LIMIT: 'many' },
		{ OG_CYCLE_GENERATION_LIMIT: '0' },
		{ OG_DAILY_GENERATION_LIMIT: '5', OG_DAILY_SOCIAL_RESERVE: '6' },
		{ OG_BILLING_CYCLE_START_DAY: '31' }
	])('fails closed for %o', async (vars) => {
		const { db } = setup();
		expect(await claimGeneration({ DB: db, ...vars }, 'image', now)).toBeNull();
	});

	it('computes UTC day and billing cycle', () => {
		expect(budgetPeriods(Date.parse('2026-11-12T23:59:59Z'), 13)).toEqual({
			day: '2026-11-12',
			cycle: '2026-10-13'
		});
		expect(budgetPeriods(Date.parse('2026-11-13T00:00:00Z'), 13).cycle).toBe('2026-11-13');
		expect(budgetPeriods(Date.parse('2026-01-05T00:00:00Z'), 13).cycle).toBe('2025-12-13');
	});
});
