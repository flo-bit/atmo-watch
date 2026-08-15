import type { ContrailConfig } from '@atmo-dev/contrail';

export const config: ContrailConfig = {
	namespace: 'watch.atmo',
	collections: {
		review: {
			collection: 'social.popfeed.feed.review',
			queryable: {
				creativeWorkType: {},
				'identifiers.tmdbId': {}
			}
		},
		like: {
			collection: 'social.popfeed.feed.like'
		},
		list: {
			collection: 'social.popfeed.feed.list'
		},
		listItem: {
			collection: 'social.popfeed.feed.listItem'
		},
		comment: {
			collection: 'social.popfeed.feed.comment'
		}
	}
};
