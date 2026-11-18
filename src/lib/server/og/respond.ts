import { error, type RequestEvent } from '@sveltejs/kit';
import { serveOgImage, type OgCacheEnv } from './cache';

type OgEnv = OgCacheEnv & { ASSETS?: Fetcher };

/** The site-wide preview, never a recursive render and never the card's validator. */
async function staticPreview({ platform, request, fetch }: RequestEvent) {
	// URL and init rather than a Request: the local bindings proxy rejects Request objects.
	const url = new URL('/og.png', request.url).href;
	const init = { method: request.method === 'HEAD' ? 'HEAD' : 'GET' };
	const assets = (platform?.env as OgEnv | undefined)?.ASSETS;
	const asset = await (assets ? assets.fetch(url, init) : fetch(url, init));
	if (!asset.ok) error(503, 'Preview temporarily unavailable');
	const headers = new Headers(asset.headers);
	headers.delete('etag');
	headers.delete('last-modified');
	headers.set('Cache-Control', 'public, max-age=60');
	headers.set('X-OG-Fallback', '1');
	return new Response(asset.body, { status: 200, headers });
}

export function respondWithOgImage(
	event: RequestEvent,
	version: { key: string; etag: string },
	cacheControl: string,
	render: () => Promise<Uint8Array>
) {
	const env = event.platform?.env as OgEnv | undefined;
	const fallback = () => staticPreview(event);
	if (!env?.DB) return fallback();
	return serveOgImage({
		env,
		...version,
		cacheControl,
		request: event.request,
		waitUntil: (promise) => event.platform?.context.waitUntil(promise),
		fallback,
		render: async () => {
			const bytes = await render();
			return bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength
			) as ArrayBuffer;
		}
	});
}
