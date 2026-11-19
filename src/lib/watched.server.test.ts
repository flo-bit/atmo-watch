import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('$lib/contrail-client.server', () => ({ contrail: { get: mocks.get } }));

import { getViewerLibrary } from './watched.server';

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

describe('viewer library', () => {
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

		const { watched } = await getViewerLibrary(did);
		expect([...watched].sort()).toEqual(['movie:27205', 'movie:603', 'tv_show:1396']);
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

		const { rated } = await getViewerLibrary(did);
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

		const { watched, rated } = await getViewerLibrary(did);
		expect([...watched]).toEqual(['movie:27205']);
		expect(rated).toHaveLength(1);
	});
});
