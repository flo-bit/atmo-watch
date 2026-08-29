export type SupportedCreativeWorkType = 'movie' | 'tv_show';

export type MediaImage = { source: 'tmdb'; path: string } | { source: 'remote'; url: string };

export type MediaIdentity = {
	creativeWorkType: SupportedCreativeWorkType;
	tmdbId: number;
};

export type TopRatedMedia = MediaIdentity & {
	score: number;
	weightedScore: number;
	ratingCount: number;
};

export type MediaSummary = MediaIdentity & {
	title: string;
	poster: MediaImage | null;
};

export type MediaDetails = MediaSummary & {
	backdrop: MediaImage | null;
	overview: string;
	releaseDate: string | null;
	runtime: number | null;
	genres: string[];
	numberOfSeasons: number | null;
	numberOfEpisodes: number | null;
	status: string | null;
	tmdbScore: number | null;
	tmdbRatingCount: number;
};

export type MediaLogo = {
	path: string;
	width: number;
	height: number;
};

export type MediaFeature = {
	item: MediaDetails;
	logo: MediaLogo | null;
	popfeedScore: number | null;
	popfeedRatingCount: number;
	imdbId: string | null;
	imdbVotes: string | null;
	ratings: ExternalRating[];
};

export type MediaVideoContext = {
	creativeWorkType: 'movie' | 'tv_show' | 'tv_season' | 'tv_episode';
	tmdbId: number;
	tmdbTvSeriesId?: number;
	seasonNumber?: number;
	episodeNumber?: number;
	title: string;
	seriesTitle?: string;
};

export type MediaVideo = {
	id: string;
	key: string;
	name: string;
	type: string;
	official: boolean;
	byline?: string;
	thumbnailUrl?: string;
	containsSpoilers?: boolean;
	context?: MediaVideoContext;
	recordAuthor?: string;
	recordKey?: string;
};

export type TvEpisodeSummary = {
	id: number;
	name: string;
	overview: string;
	seasonNumber: number;
	episodeNumber: number;
	episodeType: string | null;
	airDate: string | null;
	runtime: number | null;
	still: MediaImage | null;
};

export type TvSeasonSummary = {
	id: number;
	name: string;
	overview: string;
	seasonNumber: number;
	episodeCount: number;
	airDate: string | null;
	poster: MediaImage | null;
};

export type MediaCredit = MediaSummary & {
	order: number;
	episodeCount: number | null;
	popularity: number;
	voteCount: number;
};

export type ActorSummary = {
	did: string;
	handle: string;
	displayName?: string;
	avatarUrl?: string;
};

export type ReviewCardModel = {
	uri: string;
	createdAt: string;
	author: ActorSummary;
	media: MediaSummary;
	rating: number;
	text: string;
	containsSpoilers: boolean;
	likeCount: number;
	commentCount: number;
	viewerLikeUri?: string | null;
};

export type ReviewFeedPage = {
	reviews: ReviewCardModel[];
	cursor: string | null;
};

export type ReviewCommentModel = {
	uri: string;
	author: ActorSummary;
	text: string;
	createdAt: string;
	parentUri: string;
	rootUri: string | null;
};

export type MediaListModel = {
	uri: string;
	rkey: string;
	author: ActorSummary;
	name: string;
	description: string;
	listType?: string;
	ordered: boolean;
	createdAt: string;
	itemCount: number;
	previewItems: MediaSummary[];
};

export type ExternalRating = {
	source: string;
	value: string;
};

export type WatchProvider = {
	id: number;
	name: string;
	logo_path: string;
};

export type StreamingAvailability = {
	region: string;
	region_name: string;
	link: string | null;
	providers: WatchProvider[];
};

export type CastMember = {
	id: number;
	creditId: string;
	name: string;
	character: string;
	profile_path: string | null;
};

export type PersonDetails = {
	id: number;
	name: string;
	biography: string;
	birthday: string | null;
	deathday: string | null;
	profile_path: string | null;
};
