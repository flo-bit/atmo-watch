import { afterEach, describe, expect, it, vi } from 'vitest';
import { imageVersion, MAX_IMAGE_BYTES, serveOgImage, type OgImageOptions } from './cache';
import { testBucket, testDb, tinyJpeg } from './testing';

const databases: ReturnType<typeof testDb>[] = [];
function setup() {
	const database = testDb();
	databases.push(database);
	const { bucket, objects } = testBucket();
	const options: OgImageOptions = {
		env: { DB: database.db, OG_IMAGES: bucket },
		key: 'og/v1/image.jpg',
		etag: 'W/"v1-image"',
		cacheControl: 'public, max-age=86400',
		request: new Request('https://atmo.test/movie/1/og.jpg'),
		render: vi.fn(async () => tinyJpeg.slice(0)),
		fallback: vi.fn(async () => new Response('static', { headers: { 'X-OG-Fallback': '1' } }))
	};
	return { options, bucket, objects, ...database };
}
const isFallback = async (options: OgImageOptions) =>
	(await serveOgImage(options)).headers.get('x-og-fallback') === '1';
const attempts = (sqlite: ReturnType<typeof testDb>['sqlite']) =>
	sqlite.prepare('SELECT daily_attempts FROM og_generation_budget').get()?.daily_attempts;

afterEach(() => {
	for (const { sqlite } of databases.splice(0)) sqlite.close();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('stored OG images', () => {
	it('renders once, stores the image, and serves it from storage afterwards', async () => {
		const { options, objects } = setup();
		const first = await serveOgImage(options);
		expect(first.headers.get('content-type')).toBe('image/jpeg');
		expect(first.headers.get('cache-control')).toBe('public, max-age=86400');
		expect(await first.arrayBuffer()).toEqual(tinyJpeg);
		expect(objects.get(options.key)).toEqual(tinyJpeg);
		expect(await (await serveOgImage(options)).arrayBuffer()).toEqual(tinyJpeg);
		expect(options.render).toHaveBeenCalledTimes(1);
	});

	it('coalesces simultaneous misses and gives each caller its own body', async () => {
		const { options } = setup();
		const results = await Promise.all(Array.from({ length: 12 }, () => serveOgImage(options)));
		expect(options.render).toHaveBeenCalledTimes(1);
		for (const response of results) expect(await response.arrayBuffer()).toEqual(tinyJpeg);
	});

	it('uses the database lease when another isolate is already rendering', async () => {
		const { options, objects } = setup();
		let finish!: (bytes: ArrayBuffer) => void;
		options.render = vi.fn(() => new Promise<ArrayBuffer>((resolve) => (finish = resolve)));
		const first = serveOgImage(options);
		await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
		const otherIsolate = {
			...options,
			env: { ...options.env, OG_IMAGES: testBucket(objects).bucket }
		};
		expect(await isFallback(otherIsolate)).toBe(true);
		expect(options.render).toHaveBeenCalledTimes(1);
		finish(tinyJpeg);
		expect((await first).status).toBe(200);
	});

	it('serves stored images after the budget is spent, and the static preview otherwise', async () => {
		const { options } = setup();
		options.env.OG_DAILY_GENERATION_LIMIT = '1';
		await serveOgImage(options);
		expect(await isFallback({ ...options, key: 'different' })).toBe(true);
		expect(await (await serveOgImage(options)).arrayBuffer()).toEqual(tinyJpeg);
		expect(options.render).toHaveBeenCalledTimes(1);
	});

	it('gives link unfurlers the reserved slots that browsers cannot use', async () => {
		const { options } = setup();
		options.env.OG_DAILY_GENERATION_LIMIT = '2';
		options.env.OG_DAILY_SOCIAL_RESERVE = '1';
		await serveOgImage(options);
		expect(await isFallback({ ...options, key: 'browser' })).toBe(true);
		const unfurl = new Request(options.request, { headers: { 'User-Agent': 'Twitterbot/1.0' } });
		expect(await isFallback({ ...options, key: 'shared', request: unfurl })).toBe(false);
		expect(await isFallback({ ...options, key: 'shared-2', request: unfurl })).toBe(true);
	});

	it('never renders for a crawler miss, but serves crawlers stored images', async () => {
		const { options, objects, sqlite } = setup();
		options.request = new Request(options.request, { headers: { 'User-Agent': 'GPTBot/1.4' } });
		expect(await isFallback(options)).toBe(true);
		expect(options.render).not.toHaveBeenCalled();
		expect(attempts(sqlite)).toBe(0);
		objects.set(options.key, tinyJpeg);
		expect(await (await serveOgImage(options)).arrayBuffer()).toEqual(tinyJpeg);
	});

	it('does not render on HEAD or a matching conditional request', async () => {
		const { options, objects } = setup();
		const head = new Request(options.request, { method: 'HEAD' });
		expect(await isFallback({ ...options, request: head })).toBe(true);
		objects.set(options.key, tinyJpeg);
		expect((await serveOgImage({ ...options, request: head })).body).toBeNull();
		for (const validator of [options.etag, options.etag.replace('W/', ''), '*']) {
			const result = await serveOgImage({
				...options,
				request: new Request(options.request, { headers: { 'If-None-Match': validator } })
			});
			expect(result.status).toBe(304);
		}
		expect(options.render).not.toHaveBeenCalled();
	});

	it('spends one attempt on a failure and does not retry it immediately', async () => {
		const { options, bucket, objects, sqlite } = setup();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		options.render = vi.fn(async () => {
			throw new Error('upstream artwork unavailable');
		});
		expect(await isFallback(options)).toBe(true);
		expect(await isFallback(options)).toBe(true);
		expect(options.render).toHaveBeenCalledTimes(1);
		expect(attempts(sqlite)).toBe(1);

		for (const [key, bytes] of [
			['oversized', new ArrayBuffer(MAX_IMAGE_BYTES + 1)],
			['not-jpeg', new TextEncoder().encode('<html>').buffer as ArrayBuffer]
		] as const) {
			expect(await isFallback({ ...options, key, render: async () => bytes })).toBe(true);
		}
		expect(objects.size).toBe(0);

		vi.spyOn(bucket, 'put').mockRejectedValue(new Error('R2 unavailable'));
		const render = vi.fn(async () => tinyJpeg.slice(0));
		expect(await isFallback({ ...options, key: 'unstored', render })).toBe(true);
		expect(await isFallback({ ...options, key: 'unstored', render })).toBe(true);
		expect(render).toHaveBeenCalledTimes(1);
	});

	it('falls back without rendering when storage is missing or unreadable', async () => {
		const { options, bucket } = setup();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await isFallback({ ...options, env: { DB: options.env.DB } })).toBe(true);
		vi.spyOn(bucket, 'get').mockRejectedValue(new Error('read failed'));
		expect(await isFallback(options)).toBe(true);
		expect(options.render).not.toHaveBeenCalled();
	});

	it('reads from the edge cache before R2', async () => {
		const { options } = setup();
		await serveOgImage(options);
		const entries = new Map<string, Response>();
		vi.stubGlobal('caches', {
			default: {
				match: async (key: Request) => entries.get(key.url)?.clone(),
				put: async (key: Request, value: Response) => void entries.set(key.url, value.clone())
			}
		});
		expect(await (await serveOgImage(options)).arrayBuffer()).toEqual(tinyJpeg);
		expect(entries.size).toBe(1);
		const read = vi.spyOn(options.env.OG_IMAGES!, 'get');
		expect(await (await serveOgImage(options)).arrayBuffer()).toEqual(tinyJpeg);
		expect(read).not.toHaveBeenCalled();
		expect(options.render).toHaveBeenCalledTimes(1);
	});

	it('derives a stable key from everything the card depends on', async () => {
		const first = await imageVersion(['media', 'movie', 123, null]);
		expect(first.key).toMatch(/^og\/v1\/[0-9a-f]{64}\.jpg$/);
		expect(await imageVersion(['media', 'movie', 123, null])).toEqual(first);
		for (const changed of [
			['media', 'tv_show', 123, null],
			['media', 'movie', 124, null],
			['media', 'movie', 123, '2026-09-18T01:00:00Z']
		])
			expect(await imageVersion(changed)).not.toEqual(first);
	});
});
