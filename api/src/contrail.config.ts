import type { ContrailConfig } from '@atmo-dev/contrail';

export const config: ContrailConfig = {
	namespace: 'watch.atmo',
	profiles: ['app.bsky.actor.profile'],
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
			collection: 'social.popfeed.feed.list'
		},
		listItem: {
			collection: 'social.popfeed.feed.listItem'
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
