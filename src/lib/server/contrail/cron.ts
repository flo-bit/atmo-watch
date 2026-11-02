import { ensureInit } from './runtime';

export async function runIngestion(db: D1Database) {
	const contrail = await ensureInit(db);
	let failure: { error: unknown } | undefined;
	try {
		await contrail.ingest({ maxDrainMs: 20_000, maxCandidates: 250 }, db);
	} catch (error) {
		failure = { error };
		console.error('[cron] ingest cycle failed:', error);
	}
	try {
		await contrail.retryBackfill({ maxAccounts: 5 }, db);
	} catch (error) {
		console.error('[cron] backfill retries failed:', error);
		failure ??= { error };
	}
	// Run retry maintenance even after an ingest failure, but never report a
	// failed cycle as a successful scheduled invocation (even `throw undefined`).
	if (failure) throw failure.error;
}
