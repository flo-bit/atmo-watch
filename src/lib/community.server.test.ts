import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installTestCache } from '$lib/testing/cache';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('$lib/contrail-client.server', () => ({ contrail: { get } }));
vi.mock('@svelte-atproto/oauth/server/stores/cloudflare', () => ({ cloudflareKV: vi.fn() }));

const PRESENCE = 'watch.atmo.review.getCommunityPresence';
const REVIEWS = 'watch.atmo.review.listWrittenRecords';
const RATINGS = 'watch.atmo.review.getRatingSummary';
const VIDEOS = 'watch.atmo.video.listRecords';
const empty = { hasReviews: false, hasVideos: false, hasDescendantVideos: false };
const query = { tmdbId: 123, creativeWorkType: 'movie' as const };
let flags = empty;

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-12T00:00:00Z'));
	installTestCache();
	flags = { ...empty };
	get.mockReset();
	get.mockImplementation(async (method: string) => ({
		ok: true,
		data: method === PRESENCE ? flags : method === RATINGS ? { count: 0 } : { records: [] }
	}));
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function methods() {
	return get.mock.calls.map(([method]) => method);
}

describe('catalog community gating', () => {
	it.each(['movie', 'tv_show'] as const)('uses only one API call for an empty %s', async (type) => {
		const { getMediaCommunity } = await import('./community.server');
		expect(await getMediaCommunity({ ...query, creativeWorkType: type })).toEqual({
			reviews: [],
			reviewCursor: null,
			ratingSummary: { score: null, count: 0 },
			submittedVideos: [],
			hasCommunityContent: false
		});
		expect(methods()).toEqual([PRESENCE]);
	});

	it('loads reviews and ratings for rating-only content, but no videos', async () => {
		flags = { ...empty, hasReviews: true };
		const { getMediaCommunity } = await import('./community.server');
		const data = await getMediaCommunity(query);
		expect(methods()).toEqual([PRESENCE, REVIEWS, RATINGS]);
		expect(data.hasCommunityContent).toBe(true);
	});

	it('loads TV descendant videos without loading exact-title videos or reviews', async () => {
		flags = { ...empty, hasDescendantVideos: true };
		const { getMediaCommunity } = await import('./community.server');
		const data = await getMediaCommunity({ ...query, creativeWorkType: 'tv_show' });
		expect(methods()).toEqual([PRESENCE, VIDEOS]);
		expect(get.mock.calls[1][1].params).toMatchObject({ identifiersTmdbTvSeriesId: '123' });
		expect(get.mock.calls[1][1].params).not.toHaveProperty('identifiersTmdbId');
		expect(data.hasCommunityContent).toBe(true);
	});

	it('loads exact TV videos without querying descendants', async () => {
		flags = { ...empty, hasVideos: true };
		const { getMediaCommunity } = await import('./community.server');
		await getMediaCommunity({ ...query, creativeWorkType: 'tv_show' });
		expect(methods()).toEqual([PRESENCE, VIDEOS]);
		expect(get.mock.calls[1][1].params).toMatchObject({
			creativeWorkType: 'tv_show',
			identifiersTmdbId: '123'
		});
	});

	it('coalesces presence reads, separates IDs/types and caches across isolate resets', async () => {
		let { getCommunityPresence } = await import('./community-presence.server');
		await Promise.all([getCommunityPresence(123, 'movie'), getCommunityPresence(123, 'movie')]);
		vi.resetModules();
		({ getCommunityPresence } = await import('./community-presence.server'));
		await getCommunityPresence(123, 'movie');
		expect(get).toHaveBeenCalledTimes(1);
		await getCommunityPresence(456, 'movie');
		await getCommunityPresence(123, 'tv_show');
		expect(get).toHaveBeenCalledTimes(3);
	});

	it('expires cached negatives after five minutes without restarting TTL on edge hits', async () => {
		let { getMediaCommunity } = await import('./community.server');
		await getMediaCommunity(query);
		vi.advanceTimersByTime(299_000);
		vi.resetModules();
		({ getMediaCommunity } = await import('./community.server'));
		await getMediaCommunity(query);
		expect(methods()).toEqual([PRESENCE]);
		vi.advanceTimersByTime(1_000);
		flags = { ...empty, hasReviews: true };
		expect((await getMediaCommunity(query)).hasCommunityContent).toBe(true);
		expect(methods()).toEqual([PRESENCE, PRESENCE, REVIEWS, RATINGS]);
	});

	it('bypasses cached negatives for signed-in reads and never caches viewer likes', async () => {
		const { getMediaCommunity } = await import('./community.server');
		await getMediaCommunity(query);
		await getMediaCommunity({ ...query, viewerDid: 'did:plc:alice' });
		await getMediaCommunity({ ...query, viewerDid: 'did:plc:bob' });
		expect(methods()).toEqual([PRESENCE, REVIEWS, RATINGS, VIDEOS, REVIEWS, RATINGS, VIDEOS]);
		for (const call of get.mock.calls.filter(([method]) => method === REVIEWS)) {
			expect(call[1].params.hydrateLikes).toBe(50);
		}
		expect((await getMediaCommunity(query)).hasCommunityContent).toBe(false);
		expect(get).toHaveBeenCalledTimes(7);
	});

	it('shows new ratings/videos to signed-in users even when all public caches contain negatives', async () => {
		const { getMediaCommunity } = await import('./community.server');
		const { getMediaRatingSummary } = await import('./reviews.server');
		const { getSubmittedVideos } = await import('./videos.server');
		await getMediaRatingSummary(123, 'movie');
		await getSubmittedVideos(query);
		await getMediaCommunity(query);
		get.mockImplementation(async (method: string) => ({
			ok: true,
			data:
				method === PRESENCE
					? empty
					: method === RATINGS
						? { count: 1, score: '8' }
						: method === VIDEOS
							? {
									records: [
										{
											uri: 'at://did:plc:alice/watch.atmo.alpha.video/new',
											did: 'did:plc:alice',
											rkey: 'new',
											value: {
												creativeWorkType: 'movie',
												identifiers: { tmdbId: '123' },
												title: 'Example',
												youtubeId: 'new-video',
												videoType: 'scene'
											}
										}
									]
								}
							: { records: [] }
		}));
		const signedIn = await getMediaCommunity({ ...query, viewerDid: 'did:plc:alice' });
		expect(signedIn.ratingSummary).toEqual({ count: 1, score: 8 });
		expect(signedIn.submittedVideos).toHaveLength(1);
		expect(signedIn.hasCommunityContent).toBe(true);
		// Fresh signed-in results do not populate or overwrite the anonymous caches.
		expect(await getMediaRatingSummary(123, 'movie')).toEqual({ count: 0, score: null });
		expect(await getSubmittedVideos(query)).toEqual([]);
		expect((await getMediaCommunity(query)).hasCommunityContent).toBe(false);
	});

	it('does not cache presence errors or turn an unknown title into noindex', async () => {
		get.mockResolvedValueOnce({ ok: false, status: 503 });
		const { getMediaCommunity } = await import('./community.server');
		expect((await getMediaCommunity(query)).hasCommunityContent).toBeNull();
		expect(methods()).toEqual([PRESENCE, REVIEWS, RATINGS, VIDEOS]);
		expect((await getMediaCommunity(query)).hasCommunityContent).toBe(false);
		expect(methods()).toEqual([PRESENCE, REVIEWS, RATINGS, VIDEOS, PRESENCE]);
	});

	it('treats malformed presence as unknown and retries instead of caching it', async () => {
		get.mockResolvedValueOnce({ ok: true, data: { hasReviews: false } });
		const { getCommunityPresence } = await import('./community-presence.server');
		expect(await getCommunityPresence(123, 'movie')).toBeNull();
		expect(await getCommunityPresence(123, 'movie')).toEqual(empty);
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('does not de-index known community titles when enrichment fails', async () => {
		flags = { ...empty, hasReviews: true };
		get.mockImplementation(async (method: string) =>
			method === PRESENCE ? { ok: true, data: flags } : { ok: false, status: 503 }
		);
		const { getMediaCommunity } = await import('./community.server');
		expect((await getMediaCommunity(query)).hasCommunityContent).toBe(true);
	});

	it('also gates the separate catalog videos page helper', async () => {
		const { getCatalogSubmittedVideos } = await import('./videos.server');
		expect(await getCatalogSubmittedVideos(123, 'tv_show')).toEqual([]);
		expect(methods()).toEqual([PRESENCE]);
		await getCatalogSubmittedVideos(123, 'tv_show', true);
		expect(methods()).toEqual([PRESENCE, VIDEOS, VIDEOS]);
	});
});
