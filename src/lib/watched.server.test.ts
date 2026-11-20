import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('$lib/contrail-client.server', () => ({ contrail: { get: mocks.get } }));

import { getActorLibrary } from './watched.server';

const did = 'did:plc:viewer';
const ok = (records: unknown[]) => ({ ok: true, data: { records } });
const item = (creativeWorkType: string, tmdbId: string) => ({
	value: { creativeWorkType, identifiers: { tmdbId } }
});
const review = (creativeWorkType: string, tmdbId: string, rating: number, createdAt: string) => ({
	uri: `at://${did}/social.popfeed.feed.review/${tmdbId}-${createdAt}`,
	did,
	value: {
		creativeWorkType,
		identifiers: { tmdbId },
		title: `Title ${tmdbId}`,
		rating,
		createdAt,
		posterUrl: `https://image.tmdb.org/t/p/w500/${tmdbId}.jpg`
	}
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('library', () => {
	it('combines watched lists and ratings, ignoring other lists', async () => {
		mocks.get.mockImplementation((method: string, { params }: { params: { listUri?: string } }) => {
			if (method === 'watch.atmo.list.listRecords') {
				return ok([
					{ uri: 'at://watched', value: { name: 'Seen', listType: 'watched' } },
					{ uri: 'at://legacy', value: { name: 'Watched Shows' } },
					{ uri: 'at://watchlist', value: { name: 'Later', listType: 'watchlist' } }
				]);
			}
			if (method === 'watch.atmo.listItem.listRecords') {
				if (params.listUri === 'at://watched') return ok([item('movie', '603')]);
				if (params.listUri === 'at://legacy') return ok([item('tv_show', '1396')]);
				return ok([item('movie', '999')]);
			}
			return ok([
				review('movie', '27205', 8, '2026-01-01T00:00:00.000Z'),
				review('book', '5', 10, '2026-01-01T00:00:00.000Z'),
				review('movie', 'nope', 10, '2026-01-01T00:00:00.000Z')
			]);
		});

		const { watched, watchlist } = await getActorLibrary(did);
		expect([...watched].sort()).toEqual(['movie:27205', 'movie:603', 'tv_show:1396']);
		expect(watchlist).toEqual([]);
	});

	it('lists rated titles best first, newest first within a rating, once each', async () => {
		mocks.get.mockImplementation((method: string) =>
			method === 'watch.atmo.review.listRecords'
				? ok([
						review('movie', '1', 6, '2026-03-01T00:00:00.000Z'),
						review('tv_show', '2', 10, '2026-01-01T00:00:00.000Z'),
						review('movie', '3', 10, '2026-02-01T00:00:00.000Z'),
						review('movie', '1', 9, '2026-01-01T00:00:00.000Z')
					])
				: ok([])
		);

		const { rated } = await getActorLibrary(did);
		expect(rated.map((media) => `${media.creativeWorkType}:${media.tmdbId}`)).toEqual([
			'movie:3',
			'tv_show:2',
			'movie:1'
		]);
		expect(rated[0]).toMatchObject({ title: 'Title 3', poster: { source: 'remote' } });
	});

	it('keeps what it could load when one lookup fails', async () => {
		mocks.get.mockImplementation((method: string) =>
			method === 'watch.atmo.review.listRecords'
				? ok([review('movie', '27205', 8, '2026-01-01T00:00:00.000Z')])
				: { ok: false, status: 500 }
		);

		const { watched, rated } = await getActorLibrary(did);
		expect([...watched]).toEqual(['movie:27205']);
		expect(rated).toHaveLength(1);
	});
});

describe('watchlist and liked titles', () => {
	const saved = (tmdbId: string) => ({
		did,
		value: {
			creativeWorkType: 'movie',
			identifiers: { tmdbId },
			title: `Title ${tmdbId}`,
			posterUrl: `https://image.tmdb.org/t/p/w500/${tmdbId}.jpg`
		}
	});

	it('reads watchlists from either app and drops what was already watched or rated', async () => {
		mocks.get.mockImplementation((method: string, { params }: { params: { listUri?: string } }) => {
			if (method === 'watch.atmo.list.listRecords') {
				return ok([
					{ uri: 'at://movies', value: { name: 'Movie Watchlist', listType: 'movie_watchlist' } },
					{ uri: 'at://untyped', value: { name: 'My watchlist' } },
					{ uri: 'at://seen', value: { name: 'Watched Movies', listType: 'watched_movies' } },
					{ uri: 'at://other', value: { name: 'Favourites', listType: 'default' } }
				]);
			}
			if (method === 'watch.atmo.listItem.listRecords') {
				if (params.listUri === 'at://movies') return ok([saved('1'), saved('2'), saved('3')]);
				if (params.listUri === 'at://untyped') return ok([saved('2'), saved('4')]);
				if (params.listUri === 'at://seen') return ok([item('movie', '3')]);
				return ok([saved('9')]);
			}
			return ok([review('movie', '4', 5, '2026-01-01T00:00:00.000Z')]);
		});

		const { watchlist } = await getActorLibrary(did);
		expect(watchlist.map((media) => media.tmdbId)).toEqual([1, 2]);
	});

	it('counts only well-rated titles as liked', async () => {
		mocks.get.mockImplementation((method: string) =>
			method === 'watch.atmo.review.listRecords'
				? ok([
						review('movie', '1', 6, '2026-03-01T00:00:00.000Z'),
						review('movie', '2', 7, '2026-01-01T00:00:00.000Z'),
						review('movie', '3', 10, '2026-02-01T00:00:00.000Z')
					])
				: ok([])
		);

		const { liked, rated } = await getActorLibrary(did);
		expect(liked.map((media) => media.tmdbId)).toEqual([3, 2]);
		expect(rated).toHaveLength(3);
	});
});
