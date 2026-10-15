import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installTestCache } from '$lib/testing/cache';

const { get, movieDetails, tvDetails, nowPlaying, artworkOverride, artworkRevision, environment } =
	vi.hoisted(() => ({
		get: vi.fn(),
		movieDetails: vi.fn(),
		tvDetails: vi.fn(),
		nowPlaying: vi.fn(),
		artworkOverride: vi.fn(),
		artworkRevision: vi.fn(),
		environment: { TMDB_ACCESS_TOKEN: 'test-token', OMDB_API_KEY: undefined as string | undefined }
	}));
vi.mock('$env/dynamic/private', () => ({ env: environment }));
vi.mock('$lib/contrail-client.server', () => ({ contrail: { get } }));
vi.mock('@svelte-atproto/oauth/server/stores/cloudflare', () => ({ cloudflareKV: vi.fn() }));
vi.mock('$lib/media-curation.server', () => ({
	getMediaArtworkOverride: artworkOverride,
	getMediaArtworkRevision: artworkRevision
}));
vi.mock('$lib/tmdb-request.server', async () => {
	const { withTimeout } = await import('$lib/upstream.server');
	return {
		getTmdbJson: (path: string, params: unknown, signal?: AbortSignal) =>
			withTimeout(
				'TMDB test transport',
				2_500,
				() => {
					if (path === 'movie/now_playing') return nowPlaying(params);
					if (path.startsWith('movie/')) return movieDetails(params);
					if (path.startsWith('tv/')) return tvDetails(params);
					throw new Error(`Unexpected TMDB path: ${path}`);
				},
				signal
			)
	};
});
vi.mock('@lorenzopant/tmdb', () => ({
	TMDB: class {
		movies = { details: movieDetails };
		tv_series = { details: tvDetails };
		movie_lists = { now_playing: nowPlaying };
	},
	TMDBError: class extends Error {}
}));

const TOP_RATED = 'watch.atmo.review.getTopRated';
const SUMMARY = 'watch.atmo.review.getRatingSummary';
const SIX_HOURS = 6 * 60 * 60 * 1000;
const allTimeScore = 9.324324324324325;

function media(id: number) {
	return {
		id,
		poster_path: '/poster.jpg',
		backdrop_path: '/backdrop.jpg',
		overview: 'Overview',
		genres: [],
		vote_average: 9,
		vote_count: 100,
		external_ids: { imdb_id: null },
		images: { backdrops: [], logos: [] }
	};
}

function ratingRequests() {
	return get.mock.calls.filter(([method]) => method === SUMMARY);
}

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
	installTestCache();
	environment.OMDB_API_KEY = undefined;
	artworkOverride.mockResolvedValue(null);
	artworkRevision.mockResolvedValue('0');
	vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected fetch in test')));
	movieDetails.mockResolvedValue({ ...media(123), title: 'Movie', release_date: '2026-01-01' });
	tvDetails.mockResolvedValue({
		...media(1396),
		name: 'Breaking Bad',
		first_air_date: '2008-01-20',
		episode_run_time: [56],
		number_of_seasons: 5
	});
	nowPlaying.mockResolvedValue({ results: [] });
	get.mockImplementation(async (method, options) => {
		if (method === TOP_RATED) {
			return {
				ok: true,
				data: {
					items: [
						{
							creativeWorkType: 'tv_show',
							tmdbId: 1396,
							score: '10',
							weightedScore: '7',
							count: 2
						},
						{ creativeWorkType: 'movie', tmdbId: 123, score: '8', weightedScore: '6.5', count: 3 }
					]
				}
			};
		}
		if (method === SUMMARY) {
			return {
				ok: true,
				data:
					options.params.creativeWorkType === 'tv_show'
						? { score: String(allTimeScore), count: 37 }
						: { score: '9.8', count: 100 }
			};
		}
		throw new Error(`Unexpected API method: ${method}`);
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('homepage Popfeed ratings', () => {
	it('displays all-time scores/counts while preserving the 30-day title order', async () => {
		const { getHomePage } = await import('./tmdb.server');
		const page = await getHomePage();
		expect(page.degraded).toBe(false);
		expect(page.topRated.map(({ item }) => item.tmdbId)).toEqual([1396, 123]);
		expect(
			page.topRated.map(({ popfeedScore, popfeedRatingCount }) => [
				popfeedScore,
				popfeedRatingCount
			])
		).toEqual([
			[allTimeScore, 37],
			[9.8, 100]
		]);
		expect(get).toHaveBeenCalledWith(
			SUMMARY,
			expect.objectContaining({
				params: { tmdbId: 1396, creativeWorkType: 'tv_show' }
			})
		);
		expect(get).toHaveBeenCalledWith(
			SUMMARY,
			expect.objectContaining({
				params: { tmdbId: 123, creativeWorkType: 'movie' }
			})
		);

		const { getMediaRatingSummary } = await import('./reviews.server');
		expect(await getMediaRatingSummary(1396, 'tv_show')).toEqual({
			score: page.topRated[0].popfeedScore,
			count: 37
		});
		expect(ratingRequests()).toHaveLength(2);
	});

	it('keeps the six-hour homepage cache across isolates and reuses long-lived TMDB data', async () => {
		let { getHomePage } = await import('./tmdb.server');
		await getHomePage();
		vi.advanceTimersByTime(SIX_HOURS - 1000);
		vi.resetModules();
		({ getHomePage } = await import('./tmdb.server'));
		expect((await getHomePage()).topRated[0].popfeedScore).toBe(allTimeScore);
		expect(ratingRequests()).toHaveLength(2);
		expect(nowPlaying).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(1000);
		await getHomePage();
		expect(ratingRequests()).toHaveLength(4);
		expect(nowPlaying).toHaveBeenCalledTimes(2);
		expect(movieDetails).toHaveBeenCalledTimes(1);
		expect(tvDetails).toHaveBeenCalledTimes(1);
	});

	it('ignores the old homepage cache containing 30-day display scores', async () => {
		const { getPublicDataCache, writePublicDataCache } = await import('./cache.server');
		await writePublicDataCache(getPublicDataCache(SIX_HOURS / 1000), 'tmdb:home:v10:0', {
			topRated: [],
			currentlyInTheaters: []
		});
		const { getHomePage } = await import('./tmdb.server');
		expect((await getHomePage()).topRated[0].popfeedScore).toBe(allTimeScore);
		expect(ratingRequests()).toHaveLength(2);
	});

	it('keeps the title but never substitutes a 30-day score when the summary is unavailable', async () => {
		const original = get.getMockImplementation()!;
		get.mockImplementation((method, options) =>
			method === SUMMARY ? Promise.resolve({ ok: false, status: 503 }) : original(method, options)
		);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { getHomePage } = await import('./tmdb.server');
		const page = await getHomePage();
		expect(page.degraded).toBe(true);
		expect(page.topRated).toHaveLength(2);
		expect(page.topRated[0]).toMatchObject({ popfeedScore: null, popfeedRatingCount: 0 });
	});

	it('times out a stalled theaters request but preserves available top-rated titles', async () => {
		nowPlaying.mockImplementationOnce(() => new Promise(() => {}));
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { getHomePage } = await import('./tmdb.server');
		const pending = getHomePage();
		await vi.advanceTimersByTimeAsync(2_500);
		const page = await pending;
		expect(page.degraded).toBe(true);
		expect(page.topRated).toHaveLength(2);
		expect(page.currentlyInTheaters).toEqual([]);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('omits one stalled title without dropping other titles or poisoning its cache', async () => {
		movieDetails.mockImplementationOnce(() => new Promise(() => {}));
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { getHomePage } = await import('./tmdb.server');
		const pending = getHomePage();
		await vi.advanceTimersByTimeAsync(2_500);
		const page = await pending;
		expect(page.degraded).toBe(true);
		expect(page.topRated.map(({ item }) => item.tmdbId)).toEqual([1396]);
		await getHomePage();
		expect(movieDetails).toHaveBeenCalledTimes(1);
		// Degraded results have a one-minute TTL, including across isolate resets.
		vi.resetModules();
		const nextIsolate = await import('./tmdb.server');
		await nextIsolate.getHomePage();
		expect(movieDetails).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(60_000);
		const recovered = await nextIsolate.getHomePage();
		expect(recovered.degraded).toBe(false);
		expect(recovered.topRated).toHaveLength(2);
		expect(movieDetails).toHaveBeenCalledTimes(2);
	});

	it('aborts stalled OMDb fetches, keeps titles, and releases in-flight rating reads', async () => {
		environment.OMDB_API_KEY = 'test-omdb-key';
		movieDetails.mockResolvedValue({
			...media(123),
			title: 'Movie',
			release_date: '2026-01-01',
			external_ids: { imdb_id: 'tt1234567' }
		});
		let signal: AbortSignal | undefined;
		const fetcher = vi.fn((_input: unknown, init: RequestInit) => {
			signal = init.signal ?? undefined;
			return new Promise<Response>(() => {});
		});
		vi.stubGlobal('fetch', fetcher);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { getHomePage, getRatings } = await import('./tmdb.server');
		const pending = getHomePage();
		// WebCrypto's fingerprint runs on the real event loop, not the fake clock.
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1), { interval: 1 });
		await vi.advanceTimersByTimeAsync(1_800);
		const page = await pending;
		expect(signal?.aborted).toBe(true);
		expect(page.topRated).toHaveLength(2);
		expect(page.topRated[1].ratings).toEqual([]);
		expect(page.degraded).toBe(true);
		// The failure marker suppresses retries, rather than sharing a stuck promise forever.
		expect(await getRatings('tt1234567')).toEqual({ ratings: [], imdbVotes: null, degraded: true });
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('bounds stalled Cache API reads and writes instead of holding the page open', async () => {
		vi.stubGlobal('caches', {
			default: {
				match: () => new Promise(() => {}),
				put: () => new Promise(() => {})
			}
		});
		const { getHomePage } = await import('./tmdb.server');
		const pending = getHomePage();
		await vi.advanceTimersByTimeAsync(5_000);
		const page = await pending;
		expect(page.topRated).toHaveLength(2);
		expect(vi.getTimerCount()).toBe(0);
	});
});
