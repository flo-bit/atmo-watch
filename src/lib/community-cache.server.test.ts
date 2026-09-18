import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installTestCache } from '$lib/testing/cache';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('$lib/contrail-client.server', () => ({ contrail: { get } }));
vi.mock('@svelte-atproto/oauth/server/stores/cloudflare', () => ({ cloudflareKV: vi.fn() }));

const alice = 'did:plc:alice';
const bob = 'did:plc:bob';
const reviewQuery = { tmdbId: 123, creativeWorkType: 'movie' as const, limit: 12 };

function reviewResponse() {
	return {
		ok: true,
		data: {
			records: [
				{
					uri: 'at://did:plc:author/social.popfeed.feed.review/review',
					did: 'did:plc:author',
					value: {
						creativeWorkType: 'movie',
						identifiers: { tmdbId: '123' },
						title: 'Example',
						createdAt: '2026-09-18T00:00:00Z',
						rating: 8,
						text: 'A review'
					},
					likes: [
						{ did: alice, uri: 'at://alice/like/1' },
						{ did: bob, uri: 'at://bob/like/2' }
					]
				}
			],
			profiles: []
		}
	};
}

beforeEach(() => {
	vi.resetModules();
	get.mockReset();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-18T00:00:00Z'));
	installTestCache();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('public ratings and reviews', () => {
	it('caches a zero-rating summary, including across isolate resets, then expires it', async () => {
		get.mockResolvedValue({ ok: true, data: { count: 0 } });
		let { getMediaRatingSummary } = await import('./reviews.server');
		expect(await getMediaRatingSummary(123, 'movie')).toEqual({ count: 0, score: null });
		await getMediaRatingSummary(123, 'movie');
		vi.resetModules();
		({ getMediaRatingSummary } = await import('./reviews.server'));
		await getMediaRatingSummary(123, 'movie');
		expect(get).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(60_000);
		get.mockResolvedValue({ ok: true, data: { count: 1, score: '8.5' } });
		expect(await getMediaRatingSummary(123, 'movie')).toEqual({ count: 1, score: 8.5 });
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('does not restart the 60-second TTL when an edge hit warms another isolate', async () => {
		get.mockResolvedValue({ ok: true, data: { count: 0 } });
		let { getMediaRatingSummary } = await import('./reviews.server');
		await getMediaRatingSummary(123, 'movie');
		vi.advanceTimersByTime(59_000);
		vi.resetModules();
		({ getMediaRatingSummary } = await import('./reviews.server'));
		await getMediaRatingSummary(123, 'movie');
		expect(get).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(1_000);
		await getMediaRatingSummary(123, 'movie');
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('coalesces simultaneous rating reads and separates title IDs/types', async () => {
		get.mockResolvedValue({ ok: true, data: { count: 2, score: '8' } });
		const { getMediaRatingSummary } = await import('./reviews.server');
		await Promise.all([getMediaRatingSummary(123, 'movie'), getMediaRatingSummary(123, 'movie')]);
		expect(get).toHaveBeenCalledTimes(1);
		await getMediaRatingSummary(123, 'tv_show');
		await getMediaRatingSummary(456, 'movie');
		expect(get).toHaveBeenCalledTimes(3);
	});

	it('does not cache an upstream rating error', async () => {
		get.mockResolvedValueOnce({ ok: false, status: 503 });
		get.mockResolvedValueOnce({ ok: true, data: { count: 0 } });
		const { getMediaRatingSummary } = await import('./reviews.server');
		await expect(getMediaRatingSummary(123, 'movie')).rejects.toThrow('503');
		expect(await getMediaRatingSummary(123, 'movie')).toEqual({ count: 0, score: null });
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('caches successful empty review pages, then refreshes after 60 seconds', async () => {
		get.mockResolvedValue({ ok: true, data: { records: [] } });
		const { getMediaReviewsPage } = await import('./reviews.server');
		expect(await getMediaReviewsPage(reviewQuery)).toEqual({ reviews: [], cursor: null });
		await getMediaReviewsPage({ ...reviewQuery, viewerDid: null });
		expect(get).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(60_000);
		await getMediaReviewsPage(reviewQuery);
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('separates review cursors, page sizes, title IDs and media types', async () => {
		get.mockResolvedValue({ ok: true, data: { records: [] } });
		const { getMediaReviewsPage } = await import('./reviews.server');
		for (const query of [
			reviewQuery,
			{ ...reviewQuery, cursor: 'next-page' },
			{ ...reviewQuery, limit: 24 },
			{ ...reviewQuery, tmdbId: 456 },
			{ ...reviewQuery, creativeWorkType: 'tv_show' as const }
		]) {
			await getMediaReviewsPage(query);
		}
		await getMediaReviewsPage(reviewQuery);
		expect(get).toHaveBeenCalledTimes(5);
	});

	it('never caches authenticated reviews or leaks viewer likes into public/other-user responses', async () => {
		get.mockImplementation(async () => reviewResponse());
		const { getMediaReviewsPage } = await import('./reviews.server');
		const firstAlice = await getMediaReviewsPage({ ...reviewQuery, viewerDid: alice });
		expect(firstAlice.reviews[0].viewerLikeUri).toBe('at://alice/like/1');
		expect(get.mock.calls[0][1].params.hydrateLikes).toBe(50);

		const anonymous = await getMediaReviewsPage(reviewQuery);
		expect(anonymous.reviews[0].viewerLikeUri).toBeNull();
		expect(get.mock.calls[1][1].params).not.toHaveProperty('hydrateLikes');
		await getMediaReviewsPage(reviewQuery);
		expect(get).toHaveBeenCalledTimes(2);

		const bobPage = await getMediaReviewsPage({ ...reviewQuery, viewerDid: bob });
		expect(bobPage.reviews[0].viewerLikeUri).toBe('at://bob/like/2');
		await getMediaReviewsPage({ ...reviewQuery, viewerDid: alice });
		expect(get).toHaveBeenCalledTimes(4);
		expect((await getMediaReviewsPage(reviewQuery)).reviews[0].viewerLikeUri).toBeNull();
		expect(get).toHaveBeenCalledTimes(4);
	});

	it('does not cache a failed anonymous review request as an empty page', async () => {
		get.mockResolvedValueOnce({ ok: false, status: 503 });
		get.mockResolvedValueOnce({ ok: true, data: { records: [] } });
		const { getMediaReviewsPage } = await import('./reviews.server');
		await expect(getMediaReviewsPage(reviewQuery)).rejects.toThrow('503');
		expect(await getMediaReviewsPage(reviewQuery)).toEqual({ reviews: [], cursor: null });
		expect(get).toHaveBeenCalledTimes(2);
	});
});

describe('public submitted videos', () => {
	it('caches empty video lists, coalesces reads and refreshes after 60 seconds', async () => {
		get.mockResolvedValue({ ok: true, data: { records: [] } });
		const { getSubmittedVideos } = await import('./videos.server');
		const query = { creativeWorkType: 'movie' as const, tmdbId: 123 };
		expect(await Promise.all([getSubmittedVideos(query), getSubmittedVideos(query)])).toEqual([
			[],
			[]
		]);
		await getSubmittedVideos(query);
		expect(get).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(60_000);
		await getSubmittedVideos(query);
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('separates exact titles, TV descendants and season zero/other seasons', async () => {
		get.mockResolvedValue({ ok: true, data: { records: [] } });
		const { getSubmittedVideos } = await import('./videos.server');
		await getSubmittedVideos({ creativeWorkType: 'movie', tmdbId: 123 });
		await getSubmittedVideos({ creativeWorkType: 'tv_show', tmdbId: 123 });
		await getSubmittedVideos({ creativeWorkType: 'tv_season', tmdbId: 123 });
		await getSubmittedVideos({ tmdbTvSeriesId: 123 });
		await getSubmittedVideos({ tmdbTvSeriesId: 123, seasonNumber: 0 });
		await getSubmittedVideos({ tmdbTvSeriesId: 123, seasonNumber: 1 });
		await getSubmittedVideos({ tmdbTvSeriesId: 123, seasonNumber: 1 });
		expect(get).toHaveBeenCalledTimes(6);
		expect(get.mock.calls[4][1].params.identifiersSeasonNumber).toBe('0');
	});

	it('caches both TV branches without merging their cache identities', async () => {
		get.mockResolvedValue({ ok: true, data: { records: [] } });
		const { getMediaSubmittedVideos } = await import('./videos.server');
		expect(await getMediaSubmittedVideos(123, 'tv_show')).toEqual([]);
		await getMediaSubmittedVideos(123, 'tv_show');
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('does not cache failed video reads', async () => {
		get.mockRejectedValueOnce(new Error('network error'));
		get.mockResolvedValueOnce({ ok: true, data: { records: [] } });
		const { getSubmittedVideos } = await import('./videos.server');
		const query = { creativeWorkType: 'movie' as const, tmdbId: 123 };
		await expect(getSubmittedVideos(query)).rejects.toThrow('network error');
		expect(await getSubmittedVideos(query)).toEqual([]);
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('does not cache the intentionally random scene endpoint', async () => {
		get.mockResolvedValue({ ok: true, data: { records: [] } });
		const { getRandomSubmittedScenes } = await import('./videos.server');
		await getRandomSubmittedScenes();
		await getRandomSubmittedScenes();
		expect(get).toHaveBeenCalledTimes(2);
	});
});
