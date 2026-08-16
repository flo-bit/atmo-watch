export type SupportedCreativeWorkType = 'movie' | 'tv_show';

export type MediaImage = { source: 'tmdb'; path: string } | { source: 'remote'; url: string };

export type MediaIdentity = {
	creativeWorkType: SupportedCreativeWorkType;
	tmdbId: number;
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
};

export type MediaCredit = MediaSummary & {
	order: number;
};

export type ActorSummary = {
	did: string;
	handle: string;
	displayName?: string;
	avatarUrl?: string;
};

export type ReviewCardModel = {
	uri: string;
	author: ActorSummary;
	media: MediaSummary;
	rating: number;
	text: string;
	containsSpoilers: boolean;
	likeCount: number;
	commentCount: number;
};

export type ReviewCommentModel = {
	uri: string;
	author: ActorSummary;
	text: string;
	createdAt: string;
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
