import { env } from '$env/dynamic/private';
import {
	cachePublicData,
	getPublicDataCache,
	readPublicDataCache,
	writePublicDataCache
} from '$lib/cache.server';
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
	type TVEpisodeItem,
	type TVSeasonItem,
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
	MediaVideo,
	PersonDetails,
	StreamingAvailability,
	SupportedCreativeWorkType,
	TvEpisodeSummary,
	TvSeasonSummary,
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
const TV_SEASON_APPENDS: ['videos'] = ['videos'];

const HOUR = 60 * 60;
const WEEK = 7 * 24 * HOUR;
const MEDIA_DATA_TTL = WEEK;
const OMDB_DATA_TTL = 30 * 24 * HOUR;
const OMDB_TRANSIENT_FAILURE_TTL = HOUR;
const TV_SCHEDULE_TTL = 3 * HOUR;
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

type OmdbResponse = {
	Response: 'True' | 'False';
	Error?: string;
	Ratings?: Array<{ Source: string; Value: string }>;
	imdbVotes?: string;
};

type MediaSummarySource =
	MovieDetails | MovieResultItem | TVSeriesDetails | TVSeriesResultItem | PersonCombinedCastCredit;
type MediaDetailsSource =
	MovieDetailsWithAppends<typeof MEDIA_APPENDS> | TVDetailsWithAppends<typeof MEDIA_APPENDS>;
type MediaCoreDetailsSource = MovieDetails | TVSeriesDetails;
type TmdbMediaType = 'movie' | 'tv';

let client: TMDB | undefined;
let clientToken: string | undefined;
let omdbBlock: { keyFingerprint: string; until: number } | undefined;
const pendingRatings = new Map<string, Promise<OmdbData>>();

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

function getTvScheduleSource(
	tmdbId: number,
	cache = getPublicDataCache(TV_SCHEDULE_TTL)
): Promise<TVSeriesDetails> {
	return cachePublicData(cache, `tmdb:tv-schedule:v1:${tmdbId}`, () =>
		getClient().tv_series.details({ series_id: tmdbId })
	);
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
	source: MediaCoreDetailsSource,
	creativeWorkType: SupportedCreativeWorkType
): MediaDetails {
	const metadata =
		'release_date' in source
			? {
					releaseDate: source.release_date || null,
					runtime: source.runtime ?? null,
					numberOfSeasons: null,
					numberOfEpisodes: null,
					status: null
				}
			: {
					releaseDate: source.first_air_date || null,
					runtime: source.episode_run_time[0] ?? source.last_episode_to_air?.runtime ?? null,
					numberOfSeasons: source.number_of_seasons || null,
					numberOfEpisodes: source.number_of_episodes || null,
					status: source.status ?? null
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
		order: 'order' in source ? source.order : 0,
		popularity: source.popularity
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

function toTvEpisode(source: TVEpisodeItem | null | undefined): TvEpisodeSummary | null {
	if (!source) return null;
	return {
		id: source.id,
		name: source.name,
		overview: source.overview ?? '',
		seasonNumber: source.season_number,
		episodeNumber: source.episode_number,
		episodeType: source.episode_type ?? null,
		airDate: source.air_date || null,
		runtime: source.runtime ?? null,
		still: toTmdbImage(source.still_path)
	};
}

function toTvSeason(source: TVSeasonItem): TvSeasonSummary {
	return {
		id: source.id,
		name: source.name,
		overview: source.overview ?? '',
		seasonNumber: source.season_number,
		episodeCount: source.episode_count,
		airDate: source.air_date || null,
		poster: toTmdbImage(source.poster_path)
	};
}

function toBackdropGallery(source: MediaDetailsSource): MediaImage[] {
	const paths = [source.backdrop_path, ...source.images.backdrops.map((image) => image.file_path)];
	return [...new Set(paths.filter((path): path is string => Boolean(path)))]
		.slice(0, 6)
		.map((path) => ({ source: 'tmdb', path }));
}

function getTitleLogo(source: MediaDetailsSource) {
	const logos = source.images.logos;
	const logo =
		logos.find((candidate) => candidate.iso_639_1 === 'en') ??
		logos.find((candidate) => !candidate.iso_639_1) ??
		logos[0];

	return logo ? { path: logo.file_path, width: logo.width, height: logo.height } : null;
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

function toMediaVideos(videos: VideoItem[]): MediaVideo[] {
	const typeOrder = new Map([
		['Trailer', 0],
		['Teaser', 1],
		['Clip', 2],
		['Featurette', 3],
		['Behind the Scenes', 4]
	]);
	const seen = new Set<string>();

	return [...videos]
		.filter((video) => {
			if (video.site !== 'YouTube' || !video.key || seen.has(video.key)) return false;
			seen.add(video.key);
			return true;
		})
		.sort(
			(left, right) =>
				Number(right.official) - Number(left.official) ||
				(typeOrder.get(left.type) ?? 99) - (typeOrder.get(right.type) ?? 99) ||
				right.published_at.localeCompare(left.published_at)
		)
		.slice(0, 12)
		.map((video) => ({
			id: video.id || video.key,
			key: video.key,
			name: video.name || video.type,
			type: video.type,
			official: video.official
		}));
}

function getTrailerUrl(videos: VideoItem[]) {
	const trailer =
		videos.find(
			(video) => video.site === 'YouTube' && video.type === 'Trailer' && video.official
		) ??
		videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer') ??
		videos.find((video) => video.site === 'YouTube' && video.type === 'Teaser' && video.official) ??
		videos.find((video) => video.site === 'YouTube' && video.type === 'Teaser');

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

function getOmdbQuotaFailureTtl() {
	const now = new Date();
	const nextUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
	return Math.max(HOUR, Math.ceil((nextUtcDay - now.getTime()) / 1000));
}

function isOmdbQuotaFailure(response: Response, data: OmdbResponse | null) {
	return response.status === 429 || /request limit reached/i.test(data?.Error ?? '');
}

async function getOmdbKeyFingerprint(apiKey: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadRatings(
	imdbId: string,
	cache: ReturnType<typeof getPublicDataCache>,
	failureCache: ReturnType<typeof getPublicDataCache>,
	quotaCache: ReturnType<typeof getPublicDataCache>
): Promise<OmdbData> {
	const ratingsKey = `omdb:ratings:${imdbId}`;
	const cached = await readPublicDataCache<OmdbFetchResult>(cache, ratingsKey);
	if (cached !== undefined) return cached.data;
	const apiKey = env.OMDB_API_KEY;
	if (!apiKey) return EMPTY_OMDB_DATA;

	const keyFingerprint = await getOmdbKeyFingerprint(apiKey);
	const now = Date.now();
	const quotaKey = `omdb:quota-exhausted:${keyFingerprint}`;
	if (
		(omdbBlock?.keyFingerprint === keyFingerprint && now < omdbBlock.until) ||
		(await readPublicDataCache<boolean>(quotaCache, quotaKey)) === true
	) {
		return EMPTY_OMDB_DATA;
	}

	const failureKey = `omdb:failure:${keyFingerprint}:${imdbId}`;
	if ((await readPublicDataCache<boolean>(failureCache, failureKey)) === true) {
		return EMPTY_OMDB_DATA;
	}

	const url = new URL('https://www.omdbapi.com/');
	url.searchParams.set('i', imdbId);
	url.searchParams.set('apikey', apiKey);

	let response: Response;
	let data: OmdbResponse | null = null;

	try {
		response = await fetch(url);
		data = (await response.json()) as OmdbResponse;
	} catch (cause) {
		console.error(`OMDb request for ${imdbId} failed`, cause);
		await writePublicDataCache(failureCache, failureKey, true);
		return EMPTY_OMDB_DATA;
	}

	if (isOmdbQuotaFailure(response, data)) {
		const ttl = getOmdbQuotaFailureTtl();
		omdbBlock = { keyFingerprint, until: Date.now() + ttl * 1000 };
		await writePublicDataCache(quotaCache, quotaKey, true);
		console.warn(`OMDb request quota is exhausted; pausing requests for ${ttl} seconds`);
		return EMPTY_OMDB_DATA;
	}

	if (!response.ok) {
		console.warn(`OMDb request for ${imdbId} failed with HTTP ${response.status}`);
		await writePublicDataCache(failureCache, failureKey, true);
		return EMPTY_OMDB_DATA;
	}

	const result: OmdbFetchResult =
		data.Response === 'False'
			? { data: EMPTY_OMDB_DATA, cacheable: true }
			: {
					data: {
						ratings: (data.Ratings ?? []).map((rating) => ({
							source: rating.Source,
							value: rating.Value
						})),
						imdbVotes: data.imdbVotes && data.imdbVotes !== 'N/A' ? data.imdbVotes : null
					},
					cacheable: true
				};

	await writePublicDataCache(cache, ratingsKey, result);
	return result.data;
}

export function getRatings(
	imdbId: string,
	cache = getPublicDataCache(OMDB_DATA_TTL),
	failureCache = getPublicDataCache(OMDB_TRANSIENT_FAILURE_TTL),
	quotaCache = getPublicDataCache(getOmdbQuotaFailureTtl())
): Promise<OmdbData> {
	const pendingKey = `${env.OMDB_API_KEY ?? ''}:${imdbId}`;
	const pending = pendingRatings.get(pendingKey);
	if (pending) return pending;

	const request = loadRatings(imdbId, cache, failureCache, quotaCache).finally(() => {
		pendingRatings.delete(pendingKey);
	});
	pendingRatings.set(pendingKey, request);
	return request;
}

export async function getMediaPage(
	tmdbId: number,
	creativeWorkType: SupportedCreativeWorkType,
	region: string | null
) {
	const cache = getPublicDataCache(MEDIA_DATA_TTL);
	const omdbCache = getPublicDataCache(OMDB_DATA_TTL);
	const omdbFailureCache = getPublicDataCache(OMDB_TRANSIENT_FAILURE_TTL);
	const omdbQuotaCache = getPublicDataCache(getOmdbQuotaFailureTtl());
	const [details, currentTvDetails] = await Promise.all([
		getMediaSource(tmdbId, creativeWorkType, cache),
		creativeWorkType === 'tv_show'
			? getTvScheduleSource(tmdbId).catch((cause) => {
					console.error('Could not refresh TV schedule data from TMDB', cause);
					return null;
				})
			: Promise.resolve(null)
	]);
	const omdb = details.external_ids.imdb_id
		? await getRatings(details.external_ids.imdb_id, omdbCache, omdbFailureCache, omdbQuotaCache)
		: EMPTY_OMDB_DATA;
	const tvDetails =
		currentTvDetails ?? ('first_air_date' in details ? (details as TVSeriesDetails) : null);

	return {
		item: toMediaDetails(tvDetails ?? details, creativeWorkType),
		recommendations: details.recommendations.results.map((item) =>
			toMediaSummary(item, creativeWorkType)
		),
		cast: details.credits.cast.map(toCastMember),
		backdrops: toBackdropGallery(details),
		logo: getTitleLogo(details),
		seasons: (tvDetails?.seasons ?? []).map(toTvSeason),
		nextEpisode: toTvEpisode(tvDetails?.next_episode_to_air),
		lastEpisode: toTvEpisode(tvDetails?.last_episode_to_air),
		network: tvDetails?.networks?.[0]?.name ?? null,
		imdb_id: details.external_ids.imdb_id ?? null,
		imdb_votes: omdb.imdbVotes,
		ratings: omdb.ratings,
		trailer_url: getTrailerUrl(details.videos.results),
		videos: toMediaVideos(details.videos.results),
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

export async function getMediaHeader(tmdbId: number, creativeWorkType: SupportedCreativeWorkType) {
	const cache = getPublicDataCache(MEDIA_DATA_TTL);
	const details = await getMediaSource(tmdbId, creativeWorkType, cache);
	return {
		item: toMediaDetails(details, creativeWorkType),
		logo: getTitleLogo(details)
	};
}

export async function getTvSeasonPage(tmdbId: number, seasonNumber: number) {
	const cache = getPublicDataCache(TV_SCHEDULE_TTL);
	const mediaCache = getPublicDataCache(MEDIA_DATA_TTL);
	const [show, seasonSource, mediaDetails] = await Promise.all([
		getTvScheduleSource(tmdbId, cache),
		cachePublicData(cache, `tmdb:tv-season:v2:${tmdbId}:${seasonNumber}`, () =>
			getClient().tv_seasons.details({
				series_id: tmdbId,
				season_number: seasonNumber,
				append_to_response: TV_SEASON_APPENDS
			})
		),
		getMediaSource(tmdbId, 'tv_show', mediaCache)
	]);
	const seasons = (show.seasons ?? []).map(toTvSeason);
	const navigableSeasons = seasons
		.filter((season) => season.seasonNumber > 0)
		.sort((left, right) => left.seasonNumber - right.seasonNumber);
	const navigationIndex = navigableSeasons.findIndex(
		(season) => season.seasonNumber === seasonNumber
	);
	const season: TvSeasonSummary = {
		id: seasonSource.id,
		name: seasonSource.name,
		overview: seasonSource.overview ?? '',
		seasonNumber: seasonSource.season_number,
		episodeCount: seasonSource.episodes.length,
		airDate: seasonSource.air_date || null,
		poster: toTmdbImage(seasonSource.poster_path)
	};

	return {
		show: toMediaDetails(show, 'tv_show'),
		logo: getTitleLogo(mediaDetails),
		season,
		episodes: seasonSource.episodes.flatMap((source) => {
			const episode = toTvEpisode(source);
			return episode ? [episode] : [];
		}),
		previousSeason: navigationIndex > 0 ? navigableSeasons[navigationIndex - 1] : null,
		nextSeason:
			navigationIndex >= 0 && navigationIndex < navigableSeasons.length - 1
				? navigableSeasons[navigationIndex + 1]
				: null,
		network: show.networks?.[0]?.name ?? null,
		trailer_url: getTrailerUrl(seasonSource.videos.results)
	};
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
