import { getDialect, recordsTableName, type Database } from '@atmo-dev/contrail';

/** Existence probes use Contrail's existing queryable-field expression indexes. */
export async function communityPresenceResponse(db: Database, params: URLSearchParams) {
	const creativeWorkType = params.get('creativeWorkType');
	const rawId = params.get('tmdbId') ?? '';
	const tmdbId = Number(rawId);
	if (
		(creativeWorkType !== 'movie' && creativeWorkType !== 'tv_show') ||
		!/^\d{1,16}$/.test(rawId) ||
		!Number.isSafeInteger(tmdbId) ||
		tmdbId < 1
	) {
		return Response.json(
			{ error: 'InvalidRequest', message: 'Invalid media identity' },
			{ status: 400 }
		);
	}

	const dialect = getDialect(db);
	const exists = (collection: string, conditions: string) =>
		`EXISTS (SELECT 1 FROM ${recordsTableName(collection)} r
		 WHERE r.cid IS NOT NULL AND r.record IS NOT NULL AND ${conditions})`;
	const exact = `${dialect.jsonExtract('r.record', 'identifiers.tmdbId')} = ?
		AND ${dialect.jsonExtract('r.record', 'creativeWorkType')} = ?`;
	const descendants = `${dialect.jsonExtract('r.record', 'identifiers.tmdbTvSeriesId')} = ?`;
	const bindings = [String(tmdbId), creativeWorkType, String(tmdbId), creativeWorkType];
	if (creativeWorkType === 'tv_show') bindings.push(String(tmdbId));

	const row = await db
		.prepare(
			`SELECT ${exists('review', exact)} AS reviews,
			${exists('video', exact)} AS videos,
			${creativeWorkType === 'tv_show' ? exists('video', descendants) : '0'} AS descendants`
		)
		.bind(...bindings)
		.first<{ reviews: number; videos: number; descendants: number }>();
	if (!row) throw new Error('Community presence query returned no result');

	// No HTTP caching: the frontend owns the bounded cache, and signed-in reads
	// must be able to bypass negatives immediately after publishing.
	return Response.json(
		{
			hasReviews: Boolean(row.reviews),
			hasVideos: Boolean(row.videos),
			hasDescendantVideos: Boolean(row.descendants)
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
