import type { Database } from '@atmo-dev/contrail';

// Leave ample room for quiet periods, but warn well before Jetstream's
// approximately 36-hour live-retention window expires.
export const MAX_CHECKPOINT_AGE_MS = 30 * 60 * 1000;

export async function getIngestionHealth(db: Database, now?: number) {
	const row = await db
		.prepare('SELECT updated_at FROM source_position WHERE id = 1')
		.first<{ updated_at: number }>();
	const updatedAt = row?.updated_at;
	// A cron can update the checkpoint while the database read is in flight.
	const observedAt = now ?? Date.now();
	const valid =
		typeof updatedAt === 'number' &&
		Number.isSafeInteger(updatedAt) &&
		updatedAt > 0 &&
		updatedAt <= observedAt;
	const ageMs = valid ? observedAt - updatedAt : null;

	return {
		status: ageMs === null ? 'uninitialized' : ageMs > MAX_CHECKPOINT_AGE_MS ? 'stale' : 'ok',
		checkpointUpdatedAt: valid ? new Date(updatedAt).toISOString() : null,
		secondsSinceCheckpoint: ageMs === null ? null : Math.floor(ageMs / 1000),
		maxAgeSeconds: MAX_CHECKPOINT_AGE_MS / 1000
	};
}

export async function ingestionHealthResponse(db: Database): Promise<Response> {
	try {
		const ingestion = await getIngestionHealth(db);
		return Response.json(ingestion, {
			status: ingestion.status === 'ok' ? 200 : 503,
			headers: { 'Cache-Control': 'no-store' }
		});
	} catch (cause) {
		console.error('Could not read ingestion checkpoint', cause);
		return Response.json(
			{ status: 'error', message: 'Could not read ingestion checkpoint' },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		);
	}
}
