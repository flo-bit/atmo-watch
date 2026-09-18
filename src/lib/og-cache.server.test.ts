import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installTestCache } from '$lib/testing/cache';

vi.mock('@svelte-atproto/oauth/server/stores/cloudflare', () => ({ cloudflareKV: vi.fn() }));

function png(body = 'rendered image') {
	return new Response(body, { headers: { 'Content-Type': 'image/png' } });
}

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-18T00:00:00Z'));
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('rendered OG image cache', () => {
	it('reuses the finished PNG for 24 hours, including across module/isolate resets', async () => {
		const { cache } = installTestCache();
		let { cacheOgImage } = await import('./og-cache.server');
		const render = vi.fn(async () => png());
		const first = await cacheOgImage('movie:123', render);
		expect(first.headers.get('cache-control')).toBe('public, max-age=86400');
		expect(await first.text()).toBe('rendered image');
		vi.resetModules();
		({ cacheOgImage } = await import('./og-cache.server'));
		const hit = await cacheOgImage('movie:123', render);
		expect(await hit.text()).toBe('rendered image');
		expect(render).toHaveBeenCalledTimes(1);
		expect(cache.put).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(86_400_000);
		await cacheOgImage('movie:123', render);
		expect(render).toHaveBeenCalledTimes(2);
	});

	it('coalesces concurrent renders without sharing response streams', async () => {
		installTestCache();
		const { cacheOgImage } = await import('./og-cache.server');
		let finish!: (response: Response) => void;
		const render = vi.fn(() => new Promise<Response>((resolve) => (finish = resolve)));
		const first = cacheOgImage('movie:123', render);
		const second = cacheOgImage('movie:123', render);
		await Promise.resolve();
		expect(render).toHaveBeenCalledTimes(1);
		finish(png());
		const responses = await Promise.all([first, second]);
		expect(responses[0]).not.toBe(responses[1]);
		expect(await Promise.all(responses.map((response) => response.text()))).toEqual([
			'rendered image',
			'rendered image'
		]);
	});

	it('separates media identities and artwork revisions', async () => {
		installTestCache();
		const { cacheOgImage } = await import('./og-cache.server');
		const render = vi.fn(async () => png());
		for (const key of ['movie:123:old', 'tv_show:123:old', 'movie:123:new', 'movie:456:old']) {
			await cacheOgImage(key, render);
		}
		await cacheOgImage('movie:123:new', render);
		expect(render).toHaveBeenCalledTimes(4);
	});

	it.each([
		['error status', { status: 500, headers: { 'Content-Type': 'image/png' } }],
		['non-image response', { headers: { 'Content-Type': 'text/html' } }],
		['private response', { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private' } }],
		[
			'no-store response',
			{ headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } }
		],
		['cookie', { headers: { 'Content-Type': 'image/png', 'Set-Cookie': 'session=private' } }]
	])('does not cache a %s', async (_name, init) => {
		const { cache } = installTestCache();
		const { cacheOgImage } = await import('./og-cache.server');
		const render = vi.fn(async () => new Response('not cacheable', init));
		await cacheOgImage('movie:123', render);
		await cacheOgImage('movie:123', render);
		expect(render).toHaveBeenCalledTimes(2);
		expect(cache.put).not.toHaveBeenCalled();
	});

	it('clears a failed render so the next request can retry', async () => {
		installTestCache();
		const { cacheOgImage } = await import('./og-cache.server');
		const render = vi
			.fn()
			.mockRejectedValueOnce(new Error('renderer failed'))
			.mockResolvedValueOnce(png());
		await expect(cacheOgImage('movie:123', render)).rejects.toThrow('renderer failed');
		expect(await (await cacheOgImage('movie:123', render)).text()).toBe('rendered image');
		expect(render).toHaveBeenCalledTimes(2);
	});

	it('does not store a PNG whose renderer fails after returning response headers', async () => {
		const { cache } = installTestCache();
		const { cacheOgImage } = await import('./og-cache.server');
		const broken = new Response(
			new ReadableStream({
				start(controller) {
					controller.error(new Error('PNG stream failed'));
				}
			}),
			{ headers: { 'Content-Type': 'image/png' } }
		);
		const render = vi.fn().mockResolvedValueOnce(broken).mockResolvedValueOnce(png());
		await expect(cacheOgImage('movie:123', render)).rejects.toThrow('PNG stream failed');
		expect(cache.put).not.toHaveBeenCalled();
		expect(await (await cacheOgImage('movie:123', render)).text()).toBe('rendered image');
		expect(render).toHaveBeenCalledTimes(2);
	});

	it('renders normally when a cache read or write fails', async () => {
		const { cache } = installTestCache();
		cache.match.mockRejectedValueOnce(new Error('cache unavailable'));
		cache.put.mockRejectedValueOnce(new Error('cache full'));
		const { cacheOgImage } = await import('./og-cache.server');
		const render = vi.fn(async () => png());
		expect(await (await cacheOgImage('movie:123', render)).text()).toBe('rendered image');
		expect(await (await cacheOgImage('movie:123', render)).text()).toBe('rendered image');
		expect(render).toHaveBeenCalledTimes(2);
	});

	it('also works outside Cloudflare without retaining completed PNGs in memory', async () => {
		vi.stubGlobal('caches', undefined);
		const { cacheOgImage } = await import('./og-cache.server');
		const render = vi.fn(async () => png());
		expect(await (await cacheOgImage('movie:123', render)).text()).toBe('rendered image');
		await cacheOgImage('movie:123', render);
		expect(render).toHaveBeenCalledTimes(2);
	});
});
