import { env } from '$env/dynamic/private';
import { cachePublicData, getPublicDataCache } from '$lib/cache.server';
import {
	TMDB,
	TMDBError,
	type Cast,
	type MediaWatchProviders,
	type MovieDetails,
	type MovieDetailsWithAppends,
	type MovieResultItem,
	type PersonCombinedCastCredit,
	type PersonDetails as TmdbPersonDetails,
	type TVDetailsWithAppends,
	type TVSeriesDetails,
	type TVSeriesResultItem,
	type VideoItem,
	type WatchProvider as TmdbWatchAvailability,
	type WatchProviderItem as TmdbWatchProvider
} from '@lorenzopant/tmdb';
import type {
	CastMember,
	ExternalRating,
	MediaCredit,
	MediaDetails,
	MediaImage,
	MediaSummary,
	PersonDetails,
	StreamingAvailability,
	SupportedCreativeWorkType,
	WatchProvider
} from './types';

const MEDIA_APPENDS: [
	'credits',
	'recommendations',
	'external_ids',
	'videos',
	'watch/providers',
	'images'
] = ['credits', 'recommendations', 'external_ids', 'videos', 'watch/providers', 'images'];
const PERSON_APPENDS: ['combined_credits'] = ['combined_credits'];

const HOUR = 60 * 60;
const WEEK = 7 * 24 * HOUR;
const MEDIA_DATA_TTL = WEEK;
const DISCOVERY_TTL = 6 * HOUR;
const SEARCH_TTL = HOUR;

const EMPTY_OMDB_DATA: OmdbData = {
	ratings: [],
	imdbVotes: null
};

type OmdbData = {
	ratings: ExternalRating[];
	imdbVotes: string | null;
};

type OmdbFetchResult = {
	data: OmdbData;
	cacheable: boolean;
};

type MediaSummarySource =
	MovieDetails | MovieResultItem | TVSeriesDetails | TVSeriesResultItem | PersonCombinedCastCredit;
type MediaDetailsSource =
	MovieDetailsWithAppends<typeof MEDIA_APPENDS> | TVDetailsWithAppends<typeof MEDIA_APPENDS>;
type TmdbMediaType = 'movie' | 'tv';

let client: TMDB | undefined;
let clientToken: string | undefined;

function getClient() {
	const token = env.TMDB_ACCESS_TOKEN ?? env.TMDB_API_KEY;

	if (!token) {
		throw new Error('TMDB_ACCESS_TOKEN is not configured');
	}

	if (!client || token !== clientToken) {
		client = new TMDB(token, {
			language: 'en-US',
			region: 'US',
			retry: true
		});
		clientToken = token;
	}

	return client;
}

function getMediaSource(
	tmdbId: number,
	creativeWorkType: SupportedCreativeWorkType,
	cache: ReturnType<typeof getPublicDataCache>
): Promise<MediaDetailsSource> {
	return cachePublicData(cache, `tmdb:media:v2:${creativeWorkType}:${tmdbId}`, async () => {
		const tmdb = getClient();
		return creativeWorkType === 'movie'
			? tmdb.movies.details({
					movie_id: tmdbId,
					append_to_response: MEDIA_APPENDS,
					include_image_language: ['en', 'null']
				})
			: tmdb.tv_series.details({
					series_id: tmdbId,
					append_to_response: MEDIA_APPENDS,
					include_image_language: ['en', 'null']
				});
	});
}

function fromTmdbMediaType(mediaType: TmdbMediaType): SupportedCreativeWorkType {
	return mediaType === 'tv' ? 'tv_show' : 'movie';
}

function toTmdbImage(path: string | null | undefined): MediaImage | null {
	return path ? { source: 'tmdb', path } : null;
}

function toMediaSummary(
	source: MediaSummarySource,
	creativeWorkType: SupportedCreativeWorkType
): MediaSummary {
	return {
		tmdbId: source.id,
		creativeWorkType,
		title: 'title' in source ? source.title : source.name,
		poster: toTmdbImage(source.poster_path)
	};
}

function toMediaDetails(
	source: MediaDetailsSource,
	creativeWorkType: SupportedCreativeWorkType
): MediaDetails {
	const metadata =
		'release_date' in source
			? {
					releaseDate: source.release_date || null,
					runtime: source.runtime ?? null,
					numberOfSeasons: null
				}
			: {
					releaseDate: source.first_air_date || null,
					runtime: source.episode_run_time[0] ?? source.last_episode_to_air?.runtime ?? null,
					numberOfSeasons: source.number_of_seasons || null
				};

	return {
		...toMediaSummary(source, creativeWorkType),
		backdrop: toTmdbImage(source.backdrop_path),
		overview: source.overview ?? '',
		genres: source.genres.map((genre) => genre.name),
		...metadata
	};
}

function toMediaCredit(source: PersonCombinedCastCredit): MediaCredit {
	return {
		...toMediaSummary(source, fromTmdbMediaType(source.media_type)),
		order: 'order' in source ? source.order : 0
	};
}

function toCastMember(person: Cast): CastMember {
	return {
		id: person.id,
		name: person.name,
		character: person.character,
		profile_path: person.profile_path ?? null
	};
}

function toBackdropGallery(source: MediaDetailsSource): MediaImage[] {
	const paths = [source.backdrop_path, ...source.images.backdrops.map((image) => image.file_path)];
	return [...new Set(paths.filter((path): path is string => Boolean(path)))]
		.slice(0, 6)
		.map((path) => ({ source: 'tmdb', path }));
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function getRegionName(code: string) {
	return regionNames.of(code) ?? code;
}

function toWatchProviders(providers: TmdbWatchProvider[] | undefined): WatchProvider[] {
	return [...(providers ?? [])]
		.sort((left, right) => left.display_priority - right.display_priority)
		.map((provider) => ({
			id: provider.provider_id,
			name: provider.provider_name,
			logo_path: provider.logo_path
		}));
}

function toStreamingAvailability(
	providers: MediaWatchProviders,
	requestedRegion: string
): StreamingAvailability {
	const region = requestedRegion.toUpperCase();
	const results = providers.results as Partial<Record<string, TmdbWatchAvailability>>;
	const selected = results[region];

	return {
		region,
		region_name: getRegionName(region),
		link: selected?.link ?? null,
		providers: toWatchProviders(selected?.flatrate)
	};
}

function getTrailerUrl(videos: VideoItem[]) {
	const trailer =
		videos.find(
			(video) => video.site === 'YouTube' && video.type === 'Trailer' && video.official
		) ?? videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer');

	return trailer ? `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}` : null;
}

function toPersonDetails(person: TmdbPersonDetails): PersonDetails {
	return {
		id: person.id,
		name: person.name,
		biography: person.biography ?? '',
		birthday: person.birthday ?? null,
		deathday: person.deathday ?? null,
		profile_path: person.profile_path ?? null
	};
}

export async function getRatings(
	imdbId: string,
	cache = getPublicDataCache(MEDIA_DATA_TTL)
): Promise<OmdbData> {
	if (!env.OMDB_API_KEY) return EMPTY_OMDB_DATA;

	const result = await cachePublicData<OmdbFetchResult>(
		cache,
		`omdb:ratings:${imdbId}`,
		async () => {
			const url = new URL('https://www.omdbapi.com/');
			url.searchParams.set('i', imdbId);
			url.searchParams.set('apikey', env.OMDB_API_KEY);

			try {
				const response = await fetch(url);
				if (!response.ok) return { data: EMPTY_OMDB_DATA, cacheable: false };

				const data = (await response.json()) as {
					Response: 'True' | 'False';
					Ratings?: Array<{ Source: string; Value: string }>;
					imdbVotes?: string;
				};

				if (data.Response === 'False') {
					return { data: EMPTY_OMDB_DATA, cacheable: true };
				}

				return {
					data: {
						ratings: (data.Ratings ?? []).map((rating) => ({
							source: rating.Source,
							value: rating.Value
						})),
						imdbVotes: data.imdbVotes && data.imdbVotes !== 'N/A' ? data.imdbVotes : null
					},
					cacheable: true
				};
			} catch {
				return { data: EMPTY_OMDB_DATA, cacheable: false };
			}
		},
		(value) => value.cacheable
	);

	return result.data;
}

export async function getMediaPage(
	tmdbId: number,
	creativeWorkType: SupportedCreativeWorkType,
	region: string | null
) {
	const cache = getPublicDataCache(MEDIA_DATA_TTL);
	const details = await getMediaSource(tmdbId, creativeWorkType, cache);
	const omdb = details.external_ids.imdb_id
		? await getRatings(details.external_ids.imdb_id, cache)
		: EMPTY_OMDB_DATA;

	return {
		item: toMediaDetails(details, creativeWorkType),
		recommendations: details.recommendations.results.map((item) =>
			toMediaSummary(item, creativeWorkType)
		),
		cast: details.credits.cast.map(toCastMember),
		backdrops: toBackdropGallery(details),
		imdb_id: details.external_ids.imdb_id ?? null,
		imdb_votes: omdb.imdbVotes,
		ratings: omdb.ratings,
		trailer_url: getTrailerUrl(details.videos.results),
		streaming: region ? toStreamingAvailability(details['watch/providers'], region) : null
	};
}

async function loadHomePage() {
	const empty = {
		currentlyInTheaters: [] as MediaSummary[],
		popularMovies: [] as MediaSummary[],
		popularShows: [] as MediaSummary[]
	};
	let tmdb: TMDB;

	try {
		tmdb = getClient();
	} catch {
		return empty;
	}

	const [theatersResult, popularMoviesResult, popularTvResult] = await Promise.allSettled([
		tmdb.movie_lists.now_playing({ page: 1, region: 'US' }),
		tmdb.movie_lists.popular({ page: 1, region: 'US' }),
		tmdb.tv_lists.popular({ page: 1 })
	]);

	const currentlyInTheaters =
		theatersResult.status === 'fulfilled'
			? theatersResult.value.results
					.map((item) => toMediaSummary(item, 'movie'))
					.filter((item) => item.poster)
			: [];
	const popularMovies =
		popularMoviesResult.status === 'fulfilled'
			? popularMoviesResult.value.results
					.map((item) => toMediaSummary(item, 'movie'))
					.filter((item) => item.poster)
			: [];
	const popularShows =
		popularTvResult.status === 'fulfilled'
			? popularTvResult.value.results
					.map((item) => toMediaSummary(item, 'tv_show'))
					.filter((item) => item.poster)
			: [];

	return { currentlyInTheaters, popularMovies, popularShows };
}

export function getHomePage() {
	const cache = getPublicDataCache(DISCOVERY_TTL);
	return cachePublicData(cache, 'tmdb:home:v2', loadHomePage, (data) =>
		Boolean(
			data.currentlyInTheaters.length || data.popularMovies.length || data.popularShows.length
		)
	);
}

export function searchMedia(query: string): Promise<MediaSummary[]> {
	const normalizedQuery = query.trim();
	const cache = getPublicDataCache(SEARCH_TTL);

	return cachePublicData(
		cache,
		`tmdb:search:${normalizedQuery.toLocaleLowerCase('en-US')}`,
		async () => {
			const response = await getClient().search.multi({
				query: normalizedQuery,
				include_adult: false,
				page: 1
			});

			return response.results
				.flatMap((result) => {
					if (result.media_type !== 'movie' && result.media_type !== 'tv') return [];
					return [toMediaSummary(result, fromTmdbMediaType(result.media_type))];
				})
				.filter((item) => item.poster)
				.slice(0, 12);
		}
	);
}

export async function getDetails(
	tmdbId: number,
	creativeWorkType: SupportedCreativeWorkType
): Promise<MediaDetails> {
	const cache = getPublicDataCache(MEDIA_DATA_TTL);
	const details = await getMediaSource(tmdbId, creativeWorkType, cache);
	return toMediaDetails(details, creativeWorkType);
}

function toRecordDate(value: string | null | undefined) {
	if (!value) return undefined;
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export async function getReviewRecordMetadata(
	tmdbId: number,
	creativeWorkType: SupportedCreativeWorkType
) {
	const cache = getPublicDataCache(MEDIA_DATA_TTL);
	const details = await getMediaSource(tmdbId, creativeWorkType, cache);
	const summary = toMediaSummary(details, creativeWorkType);

	let releaseDate: string | undefined;
	let mainCredit: string | undefined;
	let mainCreditRole: 'director' | 'network' | 'creator' | 'studio' | undefined;

	if ('release_date' in details) {
		releaseDate = toRecordDate(details.release_date);
		const director = details.credits.crew.find((credit) => credit.job === 'Director');
		const studio = details.production_companies[0];
		mainCredit = director?.name ?? studio?.name;
		mainCreditRole = director ? 'director' : studio ? 'studio' : undefined;
	} else {
		releaseDate = toRecordDate(details.first_air_date);
		const network = details.networks?.[0];
		const creator = details.created_by?.[0];
		mainCredit = network?.name ?? creator?.name;
		mainCreditRole = network ? 'network' : creator ? 'creator' : undefined;
	}

	return {
		title: summary.title,
		backdrop: toTmdbImage(details.backdrop_path),
		genres: details.genres.map((genre) => genre.name),
		imdbId: details.external_ids.imdb_id ?? undefined,
		releaseDate,
		mainCredit,
		mainCreditRole
	};
}

export function getPersonPage(personId: number) {
	const cache = getPublicDataCache(MEDIA_DATA_TTL);
	return cachePublicData(cache, `tmdb:person:${personId}`, async () => {
		const person = await getClient().people.details({
			person_id: personId,
			append_to_response: PERSON_APPENDS
		});

		return {
			personDetails: toPersonDetails(person),
			combinedCredits: person.combined_credits.cast.map(toMediaCredit)
		};
	});
}

export { TMDBError };
