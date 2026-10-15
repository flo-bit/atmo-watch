import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('@svelte-atproto/oauth/server/stores/cloudflare', () => ({
	cloudflareKV: () => () => ({ get })
}));

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers();
	get.mockReset();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

it('bounds stalled artwork revision/override KV reads with safe defaults', async () => {
	get.mockImplementation(() => new Promise(() => {}));
	const { getMediaArtworkRevision, getMediaArtworkOverride } =
		await import('./media-curation.server');
	const revision = getMediaArtworkRevision();
	const override = getMediaArtworkOverride('movie', 123);
	await vi.advanceTimersByTimeAsync(1_000);
	expect(await revision).toBe('0');
	expect(await override).toBeNull();
	expect(vi.getTimerCount()).toBe(0);
});
