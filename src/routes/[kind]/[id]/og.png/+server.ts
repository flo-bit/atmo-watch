import { ImageResponse } from '@ethercorps/sveltekit-og';
import { error, type RequestHandler } from '@sveltejs/kit';
import { backdropUrl, posterUrl } from '$lib/images';
import { getDetails, TMDBError } from '$lib/tmdb.server';
import type { MediaDetails } from '$lib/types';
import { parseMediaRouteKind, parseTmdbId } from '$lib/utils';

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function template(data: Pick<MediaDetails, 'backdrop' | 'poster' | 'title'>) {
	const backdrop = backdropUrl(data.backdrop, 'w780');
	const poster = posterUrl(data.poster, 'w500');

	return `
<div tw="bg-zinc-950 flex flex-col w-full h-full items-center justify-center">
	<div tw="flex absolute bottom-0 left-0 right-0 top-0 bg-fuchsia-400">
		${backdrop ? `<img src="${backdrop}" alt="" tw="flex h-full w-full opacity-100" />` : ''}
		<div tw="flex absolute h-full w-full bg-black/80"></div>
	</div>

	<div tw="flex flex-row w-full py-8 px-16 items-center justify-start">
		${
			poster
				? `<img src="${poster}" alt="" tw="flex h-[432px] w-72 rounded-2xl border border-zinc-700" />`
				: ''
		}
		<h2 tw="flex flex-col text-7xl font-bold text-zinc-100 text-left px-12 max-w-3xl">
			<span tw="flex tracking-tight">${escapeHtml(data.title)}</span>
		</h2>
	</div>

	<div tw="flex text-4xl text-fuchsia-400 items-end justify-end w-full px-8">
		rate on atmo.watch
	</div>
</div>`;
}

export const GET: RequestHandler = async ({ params }) => {
	const tmdbId = parseTmdbId(params.id ?? '');
	const creativeWorkType = parseMediaRouteKind(params.kind);

	if (!tmdbId || !creativeWorkType) {
		error(404, 'Not found');
	}

	try {
		const item = await getDetails(tmdbId, creativeWorkType);

		return new ImageResponse(template(item), {
			width: 1200,
			height: 630,
			headers: {
				'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
			}
		});
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) {
			error(404, 'Not found');
		}

		throw cause;
	}
};
