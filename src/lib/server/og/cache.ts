import { claimGeneration, pruneExpiredLeases, releaseGeneration, type OgBudgetEnv } from './budget';
import { canGenerateForRequest, isSocialPreview } from './request-policy';

// Bump whenever a card's layout, fonts or image selection changes.
export const OG_TEMPLATE_VERSION = 'v1';
export const OG_CONTENT_TYPE = 'image/jpeg';
// Cards are JPEG so a full month of generations stays far below R2's free storage.
export const MAX_IMAGE_BYTES = 1024 * 1024;

export interface OgCacheEnv extends OgBudgetEnv {
	OG_IMAGES?: R2Bucket;
}

/** Storage key and validator for everything a card depends on. */
export async function imageVersion(basis: unknown[]) {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(JSON.stringify([OG_TEMPLATE_VERSION, ...basis]))
	);
	const hash = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
	return {
		key: `og/${OG_TEMPLATE_VERSION}/${hash}.jpg`,
		etag: `W/"${OG_TEMPLATE_VERSION}-${hash}"`
	};
}

export function ifNoneMatchSatisfied(header: string | null, etag: string) {
	if (!header) return false;
	if (header.trim() === '*') return true;
	const stripWeak = (value: string) => value.trim().replace(/^W\//, '');
	return header.split(',').some((tag) => stripWeak(tag) === stripWeak(etag));
}

function edgeCache(): Cache | null {
	return typeof caches !== 'undefined' && caches && 'default' in caches
		? (caches as unknown as { default: Cache }).default
		: null;
}

// In-isolate coalescing supplements (never replaces) the durable D1 lease.
const pendingByBucket = new WeakMap<R2Bucket, Map<string, Promise<ArrayBuffer | null>>>();

export interface OgImageOptions {
	env: OgCacheEnv;
	key: string;
	etag: string;
	request: Request;
	/** `Cache-Control` of the public response. Storage is versioned separately. */
	cacheControl: string;
	render: () => Promise<ArrayBuffer>;
	fallback: () => Promise<Response>;
	waitUntil?: (promise: Promise<unknown>) => void;
}

function response(body: BodyInit | null, { request, etag, cacheControl }: OgImageOptions) {
	const notModified = ifNoneMatchSatisfied(request.headers.get('if-none-match'), etag);
	return new Response(notModified || request.method === 'HEAD' ? null : body, {
		status: notModified ? 304 : 200,
		headers: { 'Content-Type': OG_CONTENT_TYPE, 'Cache-Control': cacheControl, ETag: etag }
	});
}

/**
 * Edge cache, then R2, then one budgeted render. Missing bindings, R2 outages,
 * an exhausted budget and render failures all serve the static preview:
 * there is no uncapped rendering path.
 */
export async function serveOgImage(options: OgImageOptions): Promise<Response> {
	const { env, key, etag, request, fallback, waitUntil } = options;
	if (ifNoneMatchSatisfied(request.headers.get('if-none-match'), etag)) {
		return response(null, options);
	}
	const bucket = env.OG_IMAGES;
	if (!bucket) return fallback();
	const cache = edgeCache();
	const cacheKey = new Request(`https://atmo.watch/__og-image-cache/${key}`);
	try {
		const hit = await cache?.match(cacheKey);
		if (hit) {
			const result = response(hit.body, options);
			if (!result.body) await hit.body?.cancel();
			return result;
		}
		const stored = await bucket.get(key);
		if (stored) {
			if (stored.size > MAX_IMAGE_BYTES) {
				await stored.body.cancel();
				return fallback();
			}
			if (request.method === 'HEAD') {
				await stored.body.cancel();
				return response(null, options);
			}
			const result = response(stored.body, options);
			// A data-center-local copy saves the R2 read on repeat requests.
			if (cache) {
				const write = cache
					.put(
						cacheKey,
						new Response(result.clone().body, {
							headers: { 'Content-Type': OG_CONTENT_TYPE, 'Cache-Control': 'public, max-age=86400' }
						})
					)
					.catch(() => {});
				if (waitUntil) waitUntil(write);
				else await write;
			}
			return result;
		}
	} catch (cause) {
		console.error('[og] cache read failed; using static preview', cause);
		return fallback();
	}
	// HEAD and bulk crawlers must not generate. Keep this after the reads so
	// stored images remain available to both.
	if (request.method === 'HEAD' || !canGenerateForRequest(request)) return fallback();

	let pending = pendingByBucket.get(bucket);
	if (!pending) pendingByBucket.set(bucket, (pending = new Map()));
	let generation = pending.get(key);
	if (!generation) {
		generation = generate(options, bucket);
		pending.set(key, generation);
		void generation.finally(() => pending!.delete(key));
	}
	const bytes = await generation;
	return bytes ? response(bytes, options) : fallback();
}

async function generate(options: OgImageOptions, bucket: R2Bucket): Promise<ArrayBuffer | null> {
	const { env, key, render, request } = options;
	try {
		const token = await claimGeneration(env, key, Date.now(), isSocialPreview(request));
		if (!token) return null;
		// Another isolate may have stored it between our read and the claim.
		const stored = await bucket.get(key);
		if (stored && stored.size > MAX_IMAGE_BYTES) {
			await stored.body.cancel();
			throw new Error('Stored OG image exceeds size limit');
		}
		const bytes = stored ? await stored.arrayBuffer() : await render();
		if (bytes.byteLength > MAX_IMAGE_BYTES || !isJpeg(bytes))
			throw new Error('Invalid or oversized OG image');
		// The PUT finishes before the lease is released or the image is served.
		if (!stored) await bucket.put(key, bytes, { httpMetadata: { contentType: OG_CONTENT_TYPE } });
		try {
			await releaseGeneration(env.DB, key, token);
			await pruneExpiredLeases(env.DB);
		} catch (cause) {
			console.error('[og] lease cleanup failed', cause);
		}
		return bytes;
	} catch (cause) {
		console.error('[og] generation failed; using static preview', cause);
		return null;
	}
}

export function isJpeg(bytes: ArrayBuffer) {
	const view = new Uint8Array(bytes);
	return view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff;
}
