export type MediaKind = 'movie' | 'tv';
export type TmdbRef = `tmdb:${'m' | 's'}-${number}`;

export type Item = {
	id: number;
	ref: TmdbRef;
	media_type: MediaKind;
	title: string;
	poster_path: string | null;
	backdrop_path: string | null;
	overview: string;
	order?: number;
};

export type Review = {
	uri: string;
	author: {
		did: string;
		handle: string;
	};
	item: Pick<Item, 'id' | 'media_type' | 'title' | 'poster_path'>;
	rating: number;
	text: string;
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
