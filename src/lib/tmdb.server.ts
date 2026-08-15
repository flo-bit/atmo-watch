import { env } from '$env/dynamic/private';
import {
	TMDB,
	TMDBError,
	type Cast,
	type MediaWatchProviders,
	type MovieDetails,
	type MovieResultItem,
	type PersonCombinedCastCredit,
	type PersonDetails as TmdbPersonDetails,
	type TVSeriesDetails,
	type TVSeriesResultItem,
	type VideoItem,
	type WatchProvider as TmdbWatchAvailability,
	type WatchProviderItem as TmdbWatchProvider
} from '@lorenzopant/tmdb';
import type {
	CastMember,
	ExternalRating,
	Item,
	MediaKind,
	PersonDetails,
	StreamingAvailability,
	TmdbRef,
	WatchProvider
} from './types';

const MEDIA_APPENDS: ['credits', 'recommendations', 'external_ids', 'videos', 'watch/providers'] = [
	'credits',
	'recommendations',
	'external_ids',
	'videos',
	'watch/providers'
];
const PERSON_APPENDS: ['combined_credits'] = ['combined_credits'];

const EMPTY_OMDB_DATA: OmdbData = {
	ratings: [],
	imdbVotes: null
};

type OmdbData = {
	ratings: ExternalRating[];
	imdbVotes: string | null;
};

type MediaSource =
	| MovieDetails
	| MovieResultItem
	| TVSeriesDetails
	| TVSeriesResultItem
	| PersonCombinedCastCredit;

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
			retry: true,
			cache: { ttl: 300_000, max_size: 250 }
		});
		clientToken = token;
	}

	return client;
}

function getRef(id: number, kind: MediaKind): TmdbRef {
	return `tmdb:${kind === 'movie' ? 'm' : 's'}-${id}`;
}

function toItem(source: MediaSource, kind: MediaKind): Item {
	return {
		id: source.id,
		ref: getRef(source.id, kind),
		media_type: kind,
		title: 'title' in source ? source.title : source.name,
		poster_path: source.poster_path ?? null,
		backdrop_path: source.backdrop_path ?? null,
		overview: source.overview ?? '',
		order: 'order' in source ? source.order : undefined
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

export async function getRatings(imdbId: string): Promise<OmdbData> {
	if (!env.OMDB_API_KEY) return EMPTY_OMDB_DATA;

	const url = new URL('https://www.omdbapi.com/');
	url.searchParams.set('i', imdbId);
	url.searchParams.set('apikey', env.OMDB_API_KEY);

	try {
		const response = await fetch(url);
		if (!response.ok) return EMPTY_OMDB_DATA;

		const data = (await response.json()) as {
			Response: 'True' | 'False';
			Ratings?: Array<{ Source: string; Value: string }>;
			imdbVotes?: string;
		};

		if (data.Response === 'False') return EMPTY_OMDB_DATA;

		return {
			ratings: (data.Ratings ?? []).map((rating) => ({
				source: rating.Source,
				value: rating.Value
			})),
			imdbVotes: data.imdbVotes && data.imdbVotes !== 'N/A' ? data.imdbVotes : null
		};
	} catch {
		return EMPTY_OMDB_DATA;
	}
}

export async function getMediaPage(id: number, kind: MediaKind, region = 'US') {
	const tmdb = getClient();

	if (kind === 'movie') {
		const details = await tmdb.movies.details({
			movie_id: id,
			append_to_response: MEDIA_APPENDS
		});

		const omdb = details.external_ids.imdb_id
			? await getRatings(details.external_ids.imdb_id)
			: EMPTY_OMDB_DATA;

		return {
			item: toItem(details, kind),
			recommendations: details.recommendations.results.map((item) => toItem(item, kind)),
			cast: details.credits.cast.map(toCastMember),
			imdb_id: details.external_ids.imdb_id ?? null,
			imdb_votes: omdb.imdbVotes,
			ratings: omdb.ratings,
			trailer_url: getTrailerUrl(details.videos.results),
			streaming: toStreamingAvailability(details['watch/providers'], region)
		};
	}

	const details = await tmdb.tv_series.details({
		series_id: id,
		append_to_response: MEDIA_APPENDS
	});

	const omdb = details.external_ids.imdb_id
		? await getRatings(details.external_ids.imdb_id)
		: EMPTY_OMDB_DATA;

	return {
		item: toItem(details, kind),
		recommendations: details.recommendations.results.map((item) => toItem(item, kind)),
		cast: details.credits.cast.map(toCastMember),
		imdb_id: details.external_ids.imdb_id ?? null,
		imdb_votes: omdb.imdbVotes,
		ratings: omdb.ratings,
		trailer_url: getTrailerUrl(details.videos.results),
		streaming: toStreamingAvailability(details['watch/providers'], region)
	};
}

export async function getHomePage() {
	const empty = { currentlyInTheaters: [] as Item[], popular: [] as Item[] };
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
					.map((item) => toItem(item, 'movie'))
					.filter((item) => item.poster_path)
					.slice(0, 16)
			: [];
	const popularMovies =
		popularMoviesResult.status === 'fulfilled'
			? popularMoviesResult.value.results
					.map((item) => toItem(item, 'movie'))
					.filter((item) => item.poster_path)
			: [];
	const popularTv =
		popularTvResult.status === 'fulfilled'
			? popularTvResult.value.results
					.map((item) => toItem(item, 'tv'))
					.filter((item) => item.poster_path)
			: [];
	const popular = Array.from({ length: Math.max(popularMovies.length, popularTv.length) })
		.flatMap((_, index) => [popularMovies[index], popularTv[index]])
		.filter((item): item is Item => Boolean(item))
		.slice(0, 16);

	return { currentlyInTheaters, popular };
}

export async function searchMedia(query: string): Promise<Item[]> {
	const response = await getClient().search.multi({
		query,
		include_adult: false,
		page: 1
	});

	return response.results
		.flatMap((result) => {
			if (result.media_type !== 'movie' && result.media_type !== 'tv') return [];
			return [toItem(result, result.media_type)];
		})
		.filter((item) => item.poster_path)
		.slice(0, 12);
}

export async function getDetails(id: number, kind: MediaKind): Promise<Item> {
	const tmdb = getClient();
	const details =
		kind === 'movie'
			? await tmdb.movies.details({ movie_id: id })
			: await tmdb.tv_series.details({ series_id: id });

	return toItem(details, kind);
}

export async function getPersonPage(personId: number) {
	const person = await getClient().people.details({
		person_id: personId,
		append_to_response: PERSON_APPENDS
	});

	return {
		personDetails: toPersonDetails(person),
		combinedCredits: person.combined_credits.cast.map((item) => toItem(item, item.media_type))
	};
}

export { TMDBError };
