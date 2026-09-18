import { getCloudflareCache } from '$lib/cache.server';

const OG_IMAGE_TTL = 24 * 60 * 60;
// Bump this version when changing the image template or renderer.
const CACHE_URL_BASE = 'https://atmo.watch/__og-image-cache/v1/';

type BufferedImage = {
	body: ArrayBuffer;
	status: number;
	headers: [string, string][];
};

// Only retain in-flight images in memory, not a potentially large PNG collection.
// Coalescing is local to this isolate; Cache API entries are local to a data center.
const pendingImages = new Map<string, Promise<BufferedImage>>();

function toResponse(image: BufferedImage) {
	return new Response(image.body, { status: image.status, headers: image.headers });
}

async function bufferResponse(response: Response): Promise<BufferedImage> {
	return {
		body: await response.arrayBuffer(),
		status: response.status,
		headers: [...response.headers.entries()]
	};
}

function isCacheableImage(response: Response) {
	return (
		response.status === 200 &&
		response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'image/png' &&
		!response.headers.has('set-cookie') &&
		!/(?:private|no-store|no-cache)/i.test(response.headers.get('cache-control') ?? '')
	);
}

async function loadImage(key: string, render: () => Promise<Response>): Promise<BufferedImage> {
	const request = new Request(`${CACHE_URL_BASE}${encodeURIComponent(key)}`);
	const cache = getCloudflareCache();

	try {
		const cached = await cache?.match(request);
		if (cached && isCacheableImage(cached)) return await bufferResponse(cached);
	} catch {
		// Cache failures must not prevent generating a public preview image.
	}

	const response = await render();
	const cacheable = isCacheableImage(response);
	const image = await bufferResponse(response);
	if (!cacheable) return image;

	const headers = new Headers(image.headers);
	// Cache API does not implement stale-while-revalidate. Use an explicit TTL.
	headers.set('Cache-Control', `public, max-age=${OG_IMAGE_TTL}`);
	image.headers = [...headers.entries()];

	try {
		// Await storage so a following request cannot miss between render and put.
		await cache?.put(request, toResponse(image));
	} catch {
		// Still return the rendered image if Cache API is unavailable or full.
	}

	return image;
}

/** Cache only public PNGs. Each caller receives a fresh, independently readable body. */
export async function cacheOgImage(
	key: string,
	render: () => Promise<Response>
): Promise<Response> {
	let pending = pendingImages.get(key);
	if (!pending) {
		pending = loadImage(key, render).finally(() => {
			pendingImages.delete(key);
		});
		pendingImages.set(key, pending);
	}

	// Do not share a streaming Response across requests: its I/O belongs to the
	// request that created it in Workers. Only share the fully buffered image.
	return toResponse(await pending);
}
