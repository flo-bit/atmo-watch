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

function versionedKey(key: string) {
	return `${CACHE_VERSION}:${key}`;
}

export async function readPublicDataCache<T>(
	cache: PublicDataCache | undefined,
	key: string
): Promise<T | undefined> {
	if (!cache) return undefined;

	try {
		return (await cache.get(versionedKey(key))) as T | undefined;
	} catch {
		// Treat KV errors as cache misses.
		return undefined;
	}
}

export async function writePublicDataCache(
	cache: PublicDataCache | undefined,
	key: string,
	value: unknown
): Promise<void> {
	if (!cache) return;

	try {
		await cache.set(versionedKey(key), value);
	} catch {
		// A failed cache write should not fail the request.
	}
}

export async function cachePublicData<T>(
	cache: PublicDataCache | undefined,
	key: string,
	load: () => Promise<T>,
	shouldCache: (value: T) => boolean = () => true
): Promise<T> {
	const cached = await readPublicDataCache<T>(cache, key);
	if (cached !== undefined) return cached;

	const value = await load();
	if (shouldCache(value)) await writePublicDataCache(cache, key, value);
	return value;
}
