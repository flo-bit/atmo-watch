import { cloudflareKV } from '@svelte-atproto/oauth/server/stores/cloudflare';

type Awaitable<T> = T | PromiseLike<T>;

type PublicDataCache = {
	get(key: string): Awaitable<unknown | undefined>;
	set(key: string, value: unknown): Awaitable<void>;
};

const CACHE_BINDING = 'MEDIA_CACHE';
const CACHE_VERSION = 'v1';

/** Capture the request-scoped KV binding before the first await. */
export function getPublicDataCache(ttl: number): PublicDataCache | undefined {
	try {
		return cloudflareKV<string, unknown>(CACHE_BINDING, { ttl })();
	} catch {
		return undefined;
	}
}

export async function cachePublicData<T>(
	cache: PublicDataCache | undefined,
	key: string,
	load: () => Promise<T>,
	shouldCache: (value: T) => boolean = () => true
): Promise<T> {
	const versionedKey = `${CACHE_VERSION}:${key}`;

	if (cache) {
		try {
			const cached = await cache.get(versionedKey);
			if (cached !== undefined) return cached as T;
		} catch {
			// Treat KV errors as cache misses.
		}
	}

	const value = await load();

	if (cache && shouldCache(value)) {
		try {
			await cache.set(versionedKey, value);
		} catch {
			// A failed cache write should not fail the request.
		}
	}

	return value;
}
