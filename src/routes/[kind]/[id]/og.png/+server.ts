import { ImageResponse } from '@ethercorps/sveltekit-og';
import { error, type RequestHandler } from '@sveltejs/kit';
import { backdropUrl, logoUrl } from '$lib/images';
import { getMediaOpenGraph, TMDBError } from '$lib/tmdb.server';
import type { ExternalRating, MediaDetails, MediaLogo } from '$lib/types';
import { parseMediaRouteKind, parseTmdbId } from '$lib/utils';

function safeText(value: string) {
	return value.replaceAll('<', '‹').replaceAll('>', '›');
}

function ratingsTemplate(
	popfeedScore: number | null,
	ratings: ExternalRating[],
	tmdbScore: number | null
) {
	const items: string[] = [];
	const imdbScore = ratings
		.find((rating) => rating.source === 'Internet Movie Database')
		?.value.replace(/\/10$/, '');
	const rottenTomatoesScore = ratings.find((rating) => rating.source === 'Rotten Tomatoes')?.value;

	if (popfeedScore !== null) {
		items.push(`<div tw="mx-4 flex items-center">
		<div tw="flex h-8 w-8 items-center justify-center rounded-md" style="background-color: #e879f9;">
			<svg width="25" height="25" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M32.0001 1.09973C45.9147 1.09978 57.2008 12.0113 57.2008 25.4784C57.2008 38.9454 45.9147 49.8567 32.0001 49.8568C29.4003 49.8568 27.047 49.5296 24.7267 48.8357C24.1191 48.6539 23.4581 48.819 23.0353 49.2846L11.8188 61.6346L11.8186 61.6348C11.3415 62.1591 10.8682 62.5566 10.3222 62.7565C9.77268 62.9578 9.16181 62.9547 8.41925 62.703C7.66111 62.4459 7.25362 61.9417 7.0382 61.4125C6.82455 60.8876 6.79972 60.3386 6.79913 59.9836V25.4784C6.79915 12.0113 18.0854 1.09973 32.0001 1.09973ZM32.7157 13.178C32.3467 12.3503 31.1719 12.3503 30.8029 13.178L27.6925 20.1556C27.5403 20.4969 27.2177 20.7313 26.8461 20.7706L19.249 21.5722C18.3478 21.6674 17.9848 22.7849 18.658 23.3916L24.3329 28.5057C24.6105 28.7559 24.7332 29.1352 24.6562 29.5008L23.071 36.9738C22.883 37.8602 23.8336 38.5509 24.6186 38.0982L31.236 34.2812C31.5598 34.0945 31.9586 34.0945 32.2823 34.2812L38.8998 38.0982C39.6848 38.5509 40.6353 37.8603 40.4473 36.9738L38.8624 29.5008C38.7848 29.1352 38.9079 28.7559 39.1855 28.5057L44.8604 23.3916C45.5336 22.7849 45.1706 21.6674 44.2694 21.5722L36.6723 20.7706C36.3006 20.7313 35.978 20.497 35.8258 20.1556L32.7157 13.178Z" fill="black" />
			</svg>
		</div>
		<span tw="ml-2 flex text-2xl font-semibold text-white">${popfeedScore.toFixed(1)}</span>
	</div>`);
	}

	if (imdbScore) {
		items.push(`<div tw="mx-4 flex items-center">
		<div tw="flex h-8 items-center rounded-md px-2 text-base font-black tracking-tight" style="background-color: #f5c518; color: #000000;">IMDb</div>
		<span tw="ml-2 flex text-2xl font-semibold text-white">${safeText(imdbScore)}</span>
	</div>`);
	}

	if (rottenTomatoesScore) {
		items.push(`<div tw="mx-4 flex items-center">
		<svg width="32" height="32" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
			<path fill="#f93208" d="M395.5 103.4q1.5 2.25 2.4 4.5c-41.7-16.4-105.3 39.5-158.9 8.9c0 57.2-48 63.3-75.7 65c7.9-19 21.3-38 5.6-57c-25.7 27.6-47.4 38.2-103.3 24.2c-98.8 103.8-45.3 226.7-15.7 267.4c134.1 159.6 353 96.4 425.6-22.5c17.7-30.5 82.9-195.9-80-290.5" />
			<path fill="#02902e" d="M145.1 20.1L179.2 0l25.7 58.9c14.4-24.1 52.5-62.1 94.9-17.8c-18 4.8-28.6 14.7-29.4 32.2C328 57.4 389.6 85.5 398 107.9c-41.7-16.4-105.3 39.5-158.9 8.9c0 57.2-48 63.3-75.7 65c7.9-19 21.3-38 5.6-57c-29 31.1-52.8 40.6-126.2 17.8c18.5-6.4 56.5-43.3 93-43.5c-25.9-9.4-46.8-8-67.8-5.6c11.1-15.1 46.2-57.8 108.9-32.2z" />
		</svg>
		<span tw="ml-2 flex text-2xl font-semibold text-white">${safeText(rottenTomatoesScore)}</span>
	</div>`);
	}

	if (tmdbScore !== null) {
		items.push(`<div tw="mx-4 flex items-center">
		<svg width="56" height="24" viewBox="0 0 190.24 81.52" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<linearGradient id="tmdb-rating-gradient" x1="0" y1="0" x2="190.24" y2="0" gradientUnits="userSpaceOnUse">
					<stop offset="0" stop-color="#90cea1" />
					<stop offset="0.56" stop-color="#3cbec9" />
					<stop offset="1" stop-color="#00b3e5" />
				</linearGradient>
			</defs>
			<path fill="url(#tmdb-rating-gradient)" d="M105.67 36.06h66.9a17.67 17.67 0 0 0 17.67-17.66A17.67 17.67 0 0 0 172.57.73h-66.9A17.67 17.67 0 0 0 88 18.4a17.67 17.67 0 0 0 17.67 17.66Zm-88 45h76.9a17.67 17.67 0 0 0 17.67-17.66 17.67 17.67 0 0 0-17.67-17.67h-76.9A17.67 17.67 0 0 0 0 63.4a17.67 17.67 0 0 0 17.67 17.66ZM10.41 35.42h7.8V6.92h10.1V0h-28v6.9h10.1Zm28.1 0h7.8V8.25h.1l9 27.15h6l9.3-27.15h.1V35.4h7.8V0H66.76l-8.2 23.1h-.1L50.31 0H38.51Zm113.92 20.25a15.07 15.07 0 0 0-4.52-5.52 18.57 18.57 0 0 0-6.68-3.08 33.54 33.54 0 0 0-8.07-1h-11.7v35.4h12.75a24.58 24.58 0 0 0 7.55-1.15 19.34 19.34 0 0 0 6.35-3.32 16.27 16.27 0 0 0 4.37-5.5 16.91 16.91 0 0 0 1.63-7.58 18.5 18.5 0 0 0-1.68-8.25ZM145 68.6a8.8 8.8 0 0 1-2.64 3.4 10.7 10.7 0 0 1-4 1.82 21.57 21.57 0 0 1-5 .55h-4.05v-21h4.6a17 17 0 0 1 4.67.63 11.66 11.66 0 0 1 3.88 1.87A9.14 9.14 0 0 1 145 59a9.87 9.87 0 0 1 1 4.52 11.89 11.89 0 0 1-1 5.08Zm44.63-.13a8 8 0 0 0-1.58-2.62 8.38 8.38 0 0 0-2.42-1.85 10.31 10.31 0 0 0-3.17-1v-.1a9.22 9.22 0 0 0 4.42-2.82 7.43 7.43 0 0 0 1.68-5 8.42 8.42 0 0 0-1.15-4.65 8.09 8.09 0 0 0-3-2.72 12.56 12.56 0 0 0-4.18-1.3 32.84 32.84 0 0 0-4.62-.33h-13.2v35.4h14.5a22.41 22.41 0 0 0 4.72-.5 13.53 13.53 0 0 0 4.28-1.65 9.42 9.42 0 0 0 3.1-3 8.52 8.52 0 0 0 1.2-4.68 9.39 9.39 0 0 0-.55-3.18Zm-19.45-15.75h5.3a10 10 0 0 1 1.85.18 6.18 6.18 0 0 1 1.7.57 3.39 3.39 0 0 1 1.22 1.13 3.22 3.22 0 0 1 .48 1.82 3.63 3.63 0 0 1-.43 1.8 3.4 3.4 0 0 1-1.12 1.2 4.92 4.92 0 0 1-1.58.65 7.51 7.51 0 0 1-1.77.2h-5.65Zm11.72 20a3.9 3.9 0 0 1-1.22 1.3 4.64 4.64 0 0 1-1.68.7 8.18 8.18 0 0 1-1.82.2h-7v-8h5.9a15.35 15.35 0 0 1 2 .15 8.47 8.47 0 0 1 2.05.55 4 4 0 0 1 1.57 1.18 3.11 3.11 0 0 1 .63 2 3.71 3.71 0 0 1-.43 1.92Z" />
		</svg>
		<span tw="ml-2 flex text-2xl font-semibold text-white">${tmdbScore.toFixed(1)}</span>
	</div>`);
	}

	return items.length
		? `<div tw="mt-5 flex items-center justify-center">${items.join('')}</div>`
		: '';
}

function template(
	data: Pick<MediaDetails, 'backdrop' | 'tmdbScore'>,
	logo: MediaLogo | null,
	popfeedScore: number | null,
	ratings: ExternalRating[]
) {
	const banner = backdropUrl(data.backdrop, 'w1280');
	const wordmark = logoUrl(logo?.path, 'original');
	const ratingsMarkup = ratingsTemplate(popfeedScore, ratings, data.tmdbScore);

	return `
<div tw="relative flex h-full w-full overflow-hidden" style="background-color: #09090b;">
	<div tw="absolute bottom-0 left-0 right-0 top-0 flex" style="background-color: #701a75;">
		${banner ? `<img src="${banner}" alt="" tw="h-full w-full" style="object-fit: cover;" />` : ''}
		<div tw="absolute bottom-0 left-0 right-0 top-0 flex bg-black/10"></div>
	</div>

	<div
		tw="absolute bottom-0 left-0 right-0 flex h-[390px]"
		style="background-image: linear-gradient(to top, #09090b 0%, rgba(9, 9, 11, 0.72) 38%, rgba(9, 9, 11, 0) 100%);"
	></div>

	<div tw="absolute top-10 left-16 flex text-3xl font-bold tracking-tight text-fuchsia-400">
		atmo.watch
	</div>

	${
		wordmark || ratingsMarkup
			? `<div tw="absolute bottom-7 left-16 right-16 flex flex-col items-center">
		${wordmark ? `<img src="${wordmark}" alt="" tw="h-[170px] w-[720px]" style="object-fit: contain; object-position: center bottom;" />` : ''}
		${ratingsMarkup}
	</div>`
			: ''
	}
</div>`;
}

export const GET: RequestHandler = async ({ params }) => {
	const tmdbId = parseTmdbId(params.id ?? '');
	const creativeWorkType = parseMediaRouteKind(params.kind);

	if (!tmdbId || !creativeWorkType) {
		error(404, 'Not found');
	}

	try {
		const { item, logo, popfeedScore, ratings } = await getMediaOpenGraph(tmdbId, creativeWorkType);

		return new ImageResponse(template(item, logo, popfeedScore, ratings), {
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
