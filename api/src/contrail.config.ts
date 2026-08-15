import type { ContrailConfig } from '@atmo-dev/contrail';

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
		audience: 'did:web:api.atmo.watch',
		methods: ['notifyOfUpdate']
	},
	maintenance: { optimize: true },
	collections: {
		review: {
			collection: 'social.popfeed.feed.review',
			queryable: {
				creativeWorkType: {},
				'identifiers.tmdbId': {}
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
