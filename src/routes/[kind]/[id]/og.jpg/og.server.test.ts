import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testBucket, testDb, tinyJpeg } from '$lib/server/og/testing';

const { artwork, media, summary, render } = vi.hoisted(() => ({
	artwork: vi.fn(),
	media: vi.fn(),
	summary: vi.fn(),
	render: vi.fn()
}));

vi.mock('$lib/media-curation.server', () => ({ getMediaArtworkOverride: artwork }));
vi.mock('$lib/tmdb.server', () => ({ getMediaOpenGraph: media }));
vi.mock('$lib/reviews.server', () => ({ getMediaRatingSummary: summary }));
vi.mock('$lib/server/og/takumi', () => ({
	IMAGE_PLACEHOLDERS: { backdrop: 'backdrop', logo: 'logo', avatar: 'avatar' },
	OG_SIZE: { width: 1200, height: 630 },
	withOgRenderer: (fn: (renderer: unknown) => unknown) => fn({ renderHtml: render })
}));

let database: ReturnType<typeof testDb>;
let env: Record<string, unknown>;

beforeEach(() => {
	database = testDb();
	env = { DB: database.db, OG_IMAGES: testBucket().bucket };
	artwork.mockReset().mockResolvedValue(null);
	summary.mockReset().mockResolvedValue({ score: null, count: 0 });
	media.mockReset().mockResolvedValue({
		item: { backdrop: null, tmdbScore: null },
		logo: null,
		popfeedScore: null,
		ratings: []
	});
	render.mockReset().mockImplementation(async () => new Uint8Array(tinyJpeg.slice(0)));
});

afterEach(() => {
	database.sqlite.close();
	vi.restoreAllMocks();
});

async function request(kind = 'movie', id = '123-example', search = '') {
	const { GET } = await import('./+server');
	const url = new URL(`https://atmo.watch/${kind}/${id}/og.jpg${search}`);
	return GET({
		params: { kind, id },
		url,
		request: new Request(url),
		fetch: async () => new Response('static preview'),
		platform: { env, context: { waitUntil: () => {} } }
	} as unknown as Parameters<typeof GET>[0]);
}

describe('movie and TV OG route', () => {
	it('shares one stored image across slugs and query strings', async () => {
		expect((await request()).headers.get('content-type')).toBe('image/jpeg');
		await request('movie', '123-other-slug', '?v=untrusted&utm_source=crawler');
		await request('movie', '00123', '?random=456');
		expect(render).toHaveBeenCalledTimes(1);
		expect(media).toHaveBeenCalledExactlyOnceWith(123, 'movie', null);
	});

	it('renders again after an artwork edit or a changed community score', async () => {
		await request();
		const override = {
			updatedAt: '2026-09-18T01:00:00Z',
			updatedBy: 'did:plc:curator',
			backdropPath: '/new-artwork.jpg',
			logoPath: null
		};
		artwork.mockResolvedValue(override);
		await request();
		expect(media).toHaveBeenLastCalledWith(123, 'movie', override);
		summary.mockResolvedValue({ score: 7.5, count: 2 });
		await request();
		await request();
		expect(render).toHaveBeenCalledTimes(3);
	});

	it('keeps a movie and a TV show with the same ID apart', async () => {
		await request('movie', '123');
		await request('tv', '123');
		expect(render).toHaveBeenCalledTimes(2);
		expect(media).toHaveBeenLastCalledWith(123, 'tv_show', null);
	});

	it('serves the static preview when the title cannot be loaded', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		media.mockRejectedValueOnce(new Error('TMDB request failed with HTTP 404'));
		const response = await request();
		expect(response.headers.get('x-og-fallback')).toBe('1');
		expect(response.headers.get('cache-control')).toBe('public, max-age=60');
		expect(render).not.toHaveBeenCalled();
	});

	it.each([
		['other', '123'],
		['movie', 'invalid'],
		['movie', '0']
	])('rejects invalid media identity %s/%s before doing any work', async (kind, id) => {
		await expect(request(kind, id)).rejects.toMatchObject({ status: 404 });
		expect(artwork).not.toHaveBeenCalled();
		expect(media).not.toHaveBeenCalled();
	});
});
