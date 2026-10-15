import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const environment = vi.hoisted(() => ({
	TMDB_ACCESS_TOKEN: 'header.payload.signature' as string | undefined,
	TMDB_API_KEY: undefined as string | undefined
}));
vi.mock('$env/dynamic/private', () => ({ env: environment }));

import { getTmdbJson } from './tmdb-request.server';

beforeEach(() => {
	environment.TMDB_ACCESS_TOKEN = 'header.payload.signature';
	environment.TMDB_API_KEY = undefined;
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('bounded TMDB reads', () => {
	it('sends the existing token and media append parameters, without putting the token in the URL', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 123 }));
		vi.stubGlobal('fetch', fetcher);
		expect(await getTmdbJson('movie/123', { append_to_response: 'credits,images' })).toEqual({
			id: 123
		});
		const [url, init] = fetcher.mock.calls[0];
		expect(url.searchParams.get('append_to_response')).toBe('credits,images');
		expect(url.searchParams.get('language')).toBe('en-US');
		expect(url.searchParams.get('api_key')).toBeNull();
		expect(init.headers.get('Authorization')).toBe('Bearer header.payload.signature');
	});

	it('supports v3 API keys', async () => {
		environment.TMDB_ACCESS_TOKEN = undefined;
		environment.TMDB_API_KEY = 'test-v3-key';
		const fetcher = vi.fn().mockResolvedValue(Response.json({ results: [] }));
		vi.stubGlobal('fetch', fetcher);
		await getTmdbJson('movie/now_playing', { page: 1 });
		expect(fetcher.mock.calls[0][0].searchParams.get('api_key')).toBe('test-v3-key');
	});

	it('preserves HTTP status handling without exposing credentials in errors', async () => {
		environment.TMDB_ACCESS_TOKEN = undefined;
		environment.TMDB_API_KEY = 'private-test-key';
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 404 })));
		await expect(getTmdbJson('movie/123')).rejects.toMatchObject({
			http_status_code: 404,
			message: 'TMDB request failed with HTTP 404'
		});
	});

	it('aborts stalled requests after 2.5 seconds without SDK retry loops', async () => {
		const fetcher = vi.fn(() => new Promise<Response>(() => {}));
		vi.stubGlobal('fetch', fetcher);
		const pending = getTmdbJson('movie/123');
		const rejected = expect(pending).rejects.toThrow('timed out');
		await vi.advanceTimersByTimeAsync(2_500);
		await rejected;
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});
});
