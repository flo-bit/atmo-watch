import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getMediaPage: vi.fn(),
	getMediaCommunity: vi.fn(),
	getCommunityPresence: vi.fn(),
	getTvSeasonPage: vi.fn(),
	getSubmittedVideos: vi.fn(),
	getMediaVideosPage: vi.fn(),
	getCatalogSubmittedVideos: vi.fn()
}));
vi.mock('$lib/tmdb.server', () => ({
	getMediaPage: mocks.getMediaPage,
	getTvSeasonPage: mocks.getTvSeasonPage,
	getMediaVideosPage: mocks.getMediaVideosPage,
	TMDBError: class extends Error {
		http_status_code = 404;
	}
}));
vi.mock('$lib/community.server', () => ({ getMediaCommunity: mocks.getMediaCommunity }));
vi.mock('$lib/community-presence.server', () => ({
	getCommunityPresence: mocks.getCommunityPresence
}));
vi.mock('$lib/videos.server', () => ({
	getSubmittedVideos: mocks.getSubmittedVideos,
	getCatalogSubmittedVideos: mocks.getCatalogSubmittedVideos
}));

import { load as titleLoad } from '../routes/[kind]/[id]/+page.server';
import { load as seasonLoad } from '../routes/[kind]/[id]/season/[season]/+page.server';
import { load as videosLoad } from '../routes/[kind]/[id]/videos/+page.server';

const community = {
	reviews: [],
	reviewCursor: null,
	ratingSummary: { count: 0, score: null },
	submittedVideos: [],
	hasCommunityContent: false
};

function event(kind = 'movie', id = '000123-arbitrary-slug?region=DE', did: string | null = null) {
	const url = new URL(`https://atmo.watch/${kind}/${id}`);
	return {
		params: { kind, id: url.pathname.split('/')[2], season: '0' },
		url,
		request: new Request(url),
		locals: { did },
		setHeaders: vi.fn()
	} as unknown as Parameters<typeof titleLoad>[0] & Parameters<typeof seasonLoad>[0];
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getMediaPage.mockResolvedValue({
		item: { tmdbId: 123, creativeWorkType: 'movie', title: 'The Example' },
		videos: [{ id: 'tmdb-trailer' }]
	});
	mocks.getMediaCommunity.mockResolvedValue({ ...community });
	mocks.getCommunityPresence.mockResolvedValue({
		hasReviews: false,
		hasVideos: false,
		hasDescendantVideos: false
	});
	mocks.getTvSeasonPage.mockResolvedValue({ season: {}, show: {} });
	mocks.getMediaVideosPage.mockResolvedValue({ item: {}, videos: [], seasons: [] });
	mocks.getSubmittedVideos.mockResolvedValue([]);
	mocks.getCatalogSubmittedVideos.mockResolvedValue([]);
});

describe('catalog title SEO and validation', () => {
	it('marks known-empty titles noindex and uses a normalized canonical, not aliases or query strings', async () => {
		const input = event();
		expect(await titleLoad(input)).toMatchObject({
			canonicalUrl: 'https://atmo.watch/movie/123-the-example',
			hasCommunityContent: false,
			videos: [{ id: 'tmdb-trailer' }]
		});
		expect(input.setHeaders).toHaveBeenCalledWith({ 'X-Robots-Tag': 'noindex, nofollow' });
	});

	it.each([true, null])(
		'does not de-index present/unknown community content (%s)',
		async (present) => {
			mocks.getMediaCommunity.mockResolvedValue({ ...community, hasCommunityContent: present });
			const input = event();
			await titleLoad(input);
			expect(input.setHeaders).not.toHaveBeenCalled();
		}
	);

	it('passes the viewer through for uncached authenticated enrichment', async () => {
		await titleLoad(event('movie', '123-example', 'did:plc:alice'));
		expect(mocks.getMediaCommunity).toHaveBeenCalledWith({
			tmdbId: 123,
			creativeWorkType: 'movie',
			viewerDid: 'did:plc:alice'
		});
	});

	it('rejects invalid routes before catalog or community calls', async () => {
		await expect(titleLoad(event('movie', 'nonsense'))).rejects.toMatchObject({ status: 404 });
		await expect(titleLoad(event('cast', '123'))).rejects.toMatchObject({ status: 404 });
		expect(mocks.getMediaPage).not.toHaveBeenCalled();
		expect(mocks.getMediaCommunity).not.toHaveBeenCalled();
	});

	it('does not query community data for nonexistent TMDB entries', async () => {
		const { TMDBError } = await import('$lib/tmdb.server');
		mocks.getMediaPage.mockRejectedValueOnce(new TMDBError('Not found', 404));
		await expect(titleLoad(event())).rejects.toMatchObject({ status: 404 });
		expect(mocks.getMediaCommunity).not.toHaveBeenCalled();
	});
});

describe('secondary catalog page gating', () => {
	it('skips season video queries when there are no descendants, including season zero', async () => {
		expect(await seasonLoad(event('tv'))).toMatchObject({ submittedVideos: [] });
		expect(mocks.getSubmittedVideos).not.toHaveBeenCalled();
	});

	it('loads season videos for descendants, and bypasses negatives for authenticated requests', async () => {
		mocks.getCommunityPresence.mockResolvedValueOnce({ hasDescendantVideos: true });
		await seasonLoad(event('tv'));
		expect(mocks.getSubmittedVideos).toHaveBeenLastCalledWith(
			{ tmdbTvSeriesId: 123, seasonNumber: 0 },
			false
		);
		await seasonLoad(event('tv', '123-example', 'did:plc:alice'));
		expect(mocks.getCommunityPresence).toHaveBeenCalledTimes(1);
		expect(mocks.getSubmittedVideos).toHaveBeenLastCalledWith(
			{ tmdbTvSeriesId: 123, seasonNumber: 0 },
			true
		);
	});

	it('preserves season video reads when presence is unknown', async () => {
		mocks.getCommunityPresence.mockResolvedValueOnce(null);
		await seasonLoad(event('tv'));
		expect(mocks.getSubmittedVideos).toHaveBeenCalledTimes(1);
	});

	it('uses the gated helper on catalog video pages with the authentication flag', async () => {
		await videosLoad(event('tv', '123-example', 'did:plc:alice'));
		expect(mocks.getCatalogSubmittedVideos).toHaveBeenCalledWith(123, 'tv_show', true);
	});
});
