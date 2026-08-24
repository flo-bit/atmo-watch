import { getDialect, recordsTableName, type ContrailConfig } from '@atmo-dev/contrail';

type RandomVideoRow = {
	uri: string;
	did: string;
	rkey: string;
	cid: string;
	record: string;
	time_us: number;
};

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
							 WHERE cid IS NOT NULL AND record IS NOT NULL
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
