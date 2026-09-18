import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installTestCache } from '$lib/testing/cache';

const { artwork, media, render, NotFound } = vi.hoisted(() => {
	class NotFound extends Error {
		http_status_code = 404;
	}
	return { artwork: vi.fn(), media: vi.fn(), render: vi.fn(), NotFound };
});

vi.mock('$lib/media-curation.server', () => ({ getMediaArtworkOverride: artwork }));
vi.mock('$lib/tmdb.server', () => ({ getMediaOpenGraph: media, TMDBError: NotFound }));
vi.mock('@svelte-atproto/oauth/server/stores/cloudflare', () => ({ cloudflareKV: vi.fn() }));
vi.mock('@ethercorps/sveltekit-og', () => ({
	ImageResponse: class extends Response {
		constructor() {
			render();
			super(`png ${render.mock.calls.length}`, { headers: { 'Content-Type': 'image/png' } });
		}
	}
}));

beforeEach(() => {
	vi.resetModules();
	artwork.mockReset().mockResolvedValue(null);
	media.mockReset().mockResolvedValue({
		item: { backdrop: null, tmdbScore: null },
		logo: null,
		popfeedScore: null,
		ratings: []
	});
	render.mockReset();
	installTestCache();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

async function request(kind = 'movie', id = '123-example', search = '') {
	const { GET } = await import('./+server');
	return GET({
		params: { kind, id },
		url: new URL(`https://atmo.watch/${kind}/${id}/og.png${search}`)
	} as Parameters<typeof GET>[0]);
}

describe('movie and TV OG route', () => {
	it('shares images across slugs and ignores user-provided cache-busting parameters', async () => {
		expect(await (await request()).text()).toBe('png 1');
		expect(
			await (await request('movie', '123-other-slug', '?v=untrusted&utm_source=crawler')).text()
		).toBe('png 1');
		expect(await (await request('movie', '00123', '?random=456')).text()).toBe('png 1');
		expect(render).toHaveBeenCalledTimes(1);
		expect(media).toHaveBeenCalledExactlyOnceWith(123, 'movie', null);
	});

	it('invalidates using the actual saved artwork revision, not the URL revision', async () => {
		const override = {
			updatedAt: '2026-09-18T01:00:00Z',
			updatedBy: 'did:plc:curator',
			backdropPath: '/new-artwork.jpg',
			logoPath: null
		};
		expect(await (await request()).text()).toBe('png 1');
		artwork.mockResolvedValue(override);
		expect(await (await request()).text()).toBe('png 2');
		expect(await (await request('movie', '123', '?v=old')).text()).toBe('png 2');
		expect(media).toHaveBeenLastCalledWith(123, 'movie', override);
		// Clearing an override switches back to the original-artwork cache entry.
		artwork.mockResolvedValue(null);
		expect(await (await request()).text()).toBe('png 1');
		expect(render).toHaveBeenCalledTimes(2);
	});

	it('does not share an image between a movie and a TV show with the same ID', async () => {
		await request('movie', '123');
		await request('tv', '123');
		expect(render).toHaveBeenCalledTimes(2);
		expect(media).toHaveBeenLastCalledWith(123, 'tv_show', null);
	});

	it('keeps TMDB not-found behavior and retries rather than caching a failure', async () => {
		media.mockRejectedValueOnce(new NotFound('missing title'));
		await expect(request()).rejects.toMatchObject({ status: 404 });
		expect(render).not.toHaveBeenCalled();
		expect(await (await request()).text()).toBe('png 1');
		expect(media).toHaveBeenCalledTimes(2);
	});

	it.each([
		['other', '123'],
		['movie', 'invalid'],
		['movie', '0']
	])('rejects invalid media identity %s/%s before doing any work', async (kind, id) => {
		await expect(request(kind, id)).rejects.toMatchObject({ status: 404 });
		expect(artwork).not.toHaveBeenCalled();
		expect(media).not.toHaveBeenCalled();
		expect(render).not.toHaveBeenCalled();
	});
});
