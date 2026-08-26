import { getDialect, recordsTableName, type ContrailConfig } from '@atmo-dev/contrail';

type RandomVideoRow = {
	uri: string;
	did: string;
	rkey: string;
	cid: string;
	record: string;
	time_us: number;
};

type RatingSummaryRow = {
	rating_count: number;
	score: number | null;
};

type TopRatedRow = {
	creative_work_type: 'movie' | 'tv_show';
	tmdb_id: number;
	rating_count: number;
	score: number;
	weighted_score: number;
};

const TOP_RATED_LIMIT = 20;
const TOP_RATED_WINDOW_DAYS = 30;
const TOP_RATED_PRIOR_COUNT = 3;
const TOP_RATED_PRIOR_SCORE = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export const config: ContrailConfig = {
	namespace: 'watch.atmo',
	profiles: [
		{ collection: 'app.bsky.actor.profile', shortName: 'profile' },
		{ collection: 'social.popfeed.actor.profile', shortName: 'popfeedProfile' }
	],
	jetstreams: ['wss://jetstream1.us-east.bsky.network'],
	orderedSource: {
		source: 'jetstream',
		epoch: 'api-atmo-watch-primary-2026-08'
	},
	notify: true,
	serviceAuth: {
		audience: 'did:web:api.atmo.watch#contrail',
		methods: ['notifyOfUpdate']
	},
	maintenance: { optimize: true },
	collections: {
		video: {
			collection: 'watch.atmo.alpha.video',
			validate: true,
			queryable: {
				youtubeId: {},
				videoType: {},
				creativeWorkType: {},
				'identifiers.tmdbId': {},
				'identifiers.tmdbTvSeriesId': {},
				'identifiers.seasonNumber': {},
				'identifiers.episodeNumber': {},
				createdAt: { type: 'range' }
			},
			queries: {
				listRandomRecords: async (db, params) => {
					const rawLimit = params.get('limit');
					const limit = rawLimit === null ? 24 : Number(rawLimit);
					if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
						return Response.json(
							{ error: 'InvalidRequest', message: 'limit must be an integer from 1 to 200' },
							{ status: 400 }
						);
					}

					const result = await db
						.prepare(
							`SELECT uri, did, rkey, cid, record, time_us
							 FROM ${recordsTableName('video')}
							 WHERE cid IS NOT NULL
							   AND record IS NOT NULL
							   AND json_extract(record, '$.videoType') = 'scene'
							 ORDER BY RANDOM()
							 LIMIT ?`
						)
						.bind(limit)
						.all<RandomVideoRow>();
					const records = result.results.flatMap((row) => {
						try {
							return [
								{
									uri: row.uri,
									cid: row.cid,
									value: JSON.parse(row.record),
									did: row.did,
									collection: 'watch.atmo.alpha.video',
									rkey: row.rkey,
									time_us: row.time_us
								}
							];
						} catch {
							return [];
						}
					});

					return Response.json({ records });
				}
			}
		},
		review: {
			collection: 'social.popfeed.feed.review',
			queryable: {
				creativeWorkType: {},
				'identifiers.tmdbId': {}
			},
			pipelineQueries: {
				listWrittenRecords: async (db) => {
					const text = getDialect(db).jsonExtract('r.record', 'text');
					const whitespace =
						'CHAR(9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279)';
					return { conditions: [`TRIM(COALESCE(${text}, ''), ${whitespace}) <> ''`] };
				}
			},
			queries: {
				getTopRated: async (db) => {
					const dialect = getDialect(db);
					const workType = dialect.jsonExtract('r.record', 'creativeWorkType');
					const recordTmdbId = dialect.jsonExtract('r.record', 'identifiers.tmdbId');
					const rating = dialect.jsonExtract('r.record', 'rating');
					const cutoffUs = (Date.now() - TOP_RATED_WINDOW_DAYS * DAY_MS) * 1000;
					const priorTotal = TOP_RATED_PRIOR_COUNT * TOP_RATED_PRIOR_SCORE;
					const result = await db
						.prepare(
							`WITH recent AS (
							   SELECT r.uri,
							          r.did,
							          r.time_us,
							          ${workType} AS creative_work_type,
							          CAST(${recordTmdbId} AS INTEGER) AS tmdb_id,
							          CAST(${rating} AS REAL) AS rating
							     FROM ${recordsTableName('review')} r
							    WHERE r.cid IS NOT NULL
							      AND r.record IS NOT NULL
							      AND r.time_us >= ?
							      AND ${workType} IN ('movie', 'tv_show')
							      AND TYPEOF(${recordTmdbId}) IN ('text', 'integer')
							      AND CAST(${recordTmdbId} AS TEXT) <> ''
							      AND CAST(${recordTmdbId} AS TEXT) NOT GLOB '*[^0-9]*'
							      AND CAST(${recordTmdbId} AS INTEGER) BETWEEN 1 AND 2147483647
							      AND TYPEOF(${rating}) IN ('integer', 'real')
							      AND CAST(${rating} AS REAL) BETWEEN 0 AND 10
							 ), deduplicated AS (
							   SELECT creative_work_type,
							          tmdb_id,
							          rating,
							          time_us,
							          ROW_NUMBER() OVER (
							            PARTITION BY did, creative_work_type, tmdb_id
							            ORDER BY time_us DESC, uri ASC
							          ) AS duplicate_rank
							     FROM recent
							 ), ranked AS (
							   SELECT creative_work_type,
							          tmdb_id,
							          COUNT(*) AS rating_count,
							          AVG(rating) AS score,
							          (SUM(rating) + ?) / (COUNT(*) + ?) AS weighted_score,
							          MAX(time_us) AS latest_time_us
							     FROM deduplicated
							    WHERE duplicate_rank = 1
							    GROUP BY creative_work_type, tmdb_id
							 )
							 SELECT creative_work_type, tmdb_id, rating_count, score, weighted_score
							   FROM ranked
							  ORDER BY weighted_score DESC,
							           rating_count DESC,
							           score DESC,
							           latest_time_us DESC,
							           creative_work_type ASC,
							           tmdb_id ASC
							  LIMIT ?`
						)
						.bind(cutoffUs, priorTotal, TOP_RATED_PRIOR_COUNT, TOP_RATED_LIMIT)
						.all<TopRatedRow>();

					return Response.json(
						{
							items: result.results.map((row) => ({
								creativeWorkType: row.creative_work_type,
								tmdbId: row.tmdb_id,
								score: String(row.score),
								weightedScore: String(row.weighted_score),
								count: row.rating_count
							})),
							windowDays: TOP_RATED_WINDOW_DAYS,
							priorCount: TOP_RATED_PRIOR_COUNT,
							priorScore: String(TOP_RATED_PRIOR_SCORE)
						},
						{ headers: { 'Cache-Control': 'public, max-age=21600' } }
					);
				},
				getRatingSummary: async (db, params) => {
					const creativeWorkType = params.get('creativeWorkType');
					const tmdbId = Number(params.get('tmdbId'));
					if (
						(creativeWorkType !== 'movie' && creativeWorkType !== 'tv_show') ||
						!Number.isSafeInteger(tmdbId) ||
						tmdbId < 1
					) {
						return Response.json(
							{ error: 'InvalidRequest', message: 'Invalid media identity' },
							{ status: 400 }
						);
					}

					const dialect = getDialect(db);
					const workType = dialect.jsonExtract('r.record', 'creativeWorkType');
					const recordTmdbId = dialect.jsonExtract('r.record', 'identifiers.tmdbId');
					const rating = dialect.jsonExtract('r.record', 'rating');
					const result = await db
						.prepare(
							`SELECT COUNT(*) AS rating_count, AVG(CAST(${rating} AS REAL)) AS score
							 FROM ${recordsTableName('review')} r
							 WHERE r.cid IS NOT NULL
							   AND r.record IS NOT NULL
							   AND ${workType} = ?
							   AND ${recordTmdbId} = ?
							   AND CAST(${rating} AS REAL) BETWEEN 0 AND 10`
						)
						.bind(creativeWorkType, String(tmdbId))
						.all<RatingSummaryRow>();
					const row = result.results[0];

					return Response.json({
						count: row?.rating_count ?? 0,
						...(row?.score !== null && row?.score !== undefined ? { score: String(row.score) } : {})
					});
				}
			},
			relations: {
				likes: {
					collection: 'like',
					field: 'subjectUri',
					countDistinct: 'did'
				},
				comments: {
					collection: 'comment',
					field: 'subjectUri'
				}
			}
		},
		like: {
			collection: 'social.popfeed.feed.like',
			queryable: {
				subjectUri: {},
				subjectType: {}
			}
		},
		list: {
			collection: 'social.popfeed.feed.list',
			queryable: {
				listType: {},
				createdAt: { type: 'range' }
			},
			relations: {
				items: {
					collection: 'listItem',
					field: 'listUri'
				},
				likes: {
					collection: 'like',
					field: 'subjectUri',
					countDistinct: 'did'
				},
				comments: {
					collection: 'comment',
					field: 'subjectUri'
				}
			}
		},
		listItem: {
			collection: 'social.popfeed.feed.listItem',
			queryable: {
				listUri: {},
				listType: {},
				creativeWorkType: {},
				'identifiers.tmdbId': {},
				'identifiers.tmdbTvSeriesId': {},
				status: {},
				addedAt: { type: 'range' }
			},
			references: {
				list: {
					collection: 'list',
					field: 'listUri'
				}
			}
		},
		comment: {
			collection: 'social.popfeed.feed.comment',
			queryable: {
				subjectUri: {},
				rootUri: {},
				subjectType: {}
			}
		}
	}
};
