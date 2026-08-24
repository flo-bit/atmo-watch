import { cloudflareKV } from '@svelte-atproto/oauth/server/stores/cloudflare';

type Awaitable<T> = T | PromiseLike<T>;

type PublicDataCache = {
	get(key: string): Awaitable<unknown | undefined>;
	set(key: string, value: unknown): Awaitable<void>;
};

type MemoryEntry = {
	expiresAt: number;
	value: unknown;
};

type CloudflareCacheStorage = CacheStorage & {
	default?: Cache;
};

const KV_CACHE_BINDING = 'MEDIA_CACHE';
const CACHE_VERSION = 'v1';
const CACHE_URL_BASE = 'https://atmo.watch/__data-cache/';
const MAX_MEMORY_ENTRIES = 500;
const memoryCache = new Map<string, MemoryEntry>();
const pendingLoads = new Map<string, Promise<unknown>>();

function versionedKey(key: string) {
	return `${CACHE_VERSION}:${key}`;
}

function cacheRequest(key: string) {
	return new Request(`${CACHE_URL_BASE}${encodeURIComponent(key)}`);
}

function getCloudflareCache() {
	try {
		return (globalThis.caches as CloudflareCacheStorage | undefined)?.default;
	} catch {
		return undefined;
	}
}

function readMemoryCache(key: string) {
	const entry = memoryCache.get(key);
	if (!entry) return undefined;
	if (entry.expiresAt <= Date.now()) {
		memoryCache.delete(key);
		return undefined;
	}

	// Refresh insertion order so the map behaves like a small LRU cache.
	memoryCache.delete(key);
	memoryCache.set(key, entry);
	return entry.value;
}

function writeMemoryCache(key: string, value: unknown, ttl: number) {
	memoryCache.delete(key);
	memoryCache.set(key, { expiresAt: Date.now() + ttl * 1000, value });

	while (memoryCache.size > MAX_MEMORY_ENTRIES) {
		const oldestKey = memoryCache.keys().next().value;
		if (oldestKey === undefined) break;
		memoryCache.delete(oldestKey);
	}
}

/**
 * General public data uses the Cloudflare Cache API. Entries are local to a
 * Cloudflare data center, with a small per-isolate LRU in front.
 */
export function getPublicDataCache(ttl: number): PublicDataCache {
	return {
		async get(key) {
			const memoryValue = readMemoryCache(key);
			if (memoryValue !== undefined) return memoryValue;

			const cloudflareCache = getCloudflareCache();
			if (!cloudflareCache) return undefined;

			const response = await cloudflareCache.match(cacheRequest(key));
			if (!response) return undefined;

			const value = (await response.json()) as unknown;
			writeMemoryCache(key, value, ttl);
			return value;
		},
		async set(key, value) {
			writeMemoryCache(key, value, ttl);

			const cloudflareCache = getCloudflareCache();
			if (!cloudflareCache) return;

			await cloudflareCache.put(
				cacheRequest(key),
				new Response(JSON.stringify(value), {
					headers: {
						'Cache-Control': `public, max-age=${ttl}`,
						'Content-Type': 'application/json; charset=utf-8'
					}
				})
			);
		}
	};
}

/** Use KV only for the small, slow-changing OMDb ratings dataset. */
export function getPersistentPublicDataCache(ttl: number): PublicDataCache | undefined {
	try {
		return cloudflareKV<string, unknown>(KV_CACHE_BINDING, { ttl })();
	} catch {
		return undefined;
	}
}

export async function readPublicDataCache<T>(
	cache: PublicDataCache | undefined,
	key: string
): Promise<T | undefined> {
	if (!cache) return undefined;

	try {
		return (await cache.get(versionedKey(key))) as T | undefined;
	} catch {
		// Treat cache errors as misses.
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

	const pendingKey = versionedKey(key);
	const existing = pendingLoads.get(pendingKey);
	if (existing) return existing as Promise<T>;

	const pending = load()
		.then(async (value) => {
			if (shouldCache(value)) await writePublicDataCache(cache, key, value);
			return value;
		})
		.finally(() => {
			pendingLoads.delete(pendingKey);
		});
	pendingLoads.set(pendingKey, pending);
	return pending;
}
