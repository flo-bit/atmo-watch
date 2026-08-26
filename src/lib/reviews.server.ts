import type { ActorIdentifier, Did } from '@atcute/lexicons';
import { getAtprotoCdnImageUrl } from '$lib/atproto/images';
import { contrail } from '$lib/contrail-client.server';
import type * as CommentListRecords from '$lib/contrail/types/types/watch/atmo/comment/listRecords';
import type * as ReviewListRecords from '$lib/contrail/types/types/watch/atmo/review/listRecords';
import type {
	ActorSummary,
	MediaImage,
	ReviewCardModel,
	ReviewFeedPage,
	ReviewCommentModel,
	SupportedCreativeWorkType
} from '$lib/types';

type ReviewRecord = Pick<
	ReviewListRecords.Record,
	'uri' | 'did' | 'value' | 'likesCount' | 'commentsCount'
>;

const REVIEW_LIST_METHOD = 'watch.atmo.review.listRecords' as const;
const WRITTEN_REVIEW_LIST_METHOD = 'watch.atmo.review.listWrittenRecords' as const;
const RATING_SUMMARY_METHOD = 'watch.atmo.review.getRatingSummary' as const;

function getCreativeWorkType(value: string): SupportedCreativeWorkType | undefined {
	if (value === 'movie' || value === 'tv_show') return value;
	return undefined;
}

function getPoster(record: ReviewRecord): MediaImage | null {
	if (record.value.poster) {
		const url = getAtprotoCdnImageUrl({
			did: record.did,
			blob: record.value.poster,
			preset: 'feed_thumbnail'
		});
		if (url) return { source: 'remote', url };
	}

	return record.value.posterUrl ? { source: 'remote', url: record.value.posterUrl } : null;
}

export function toReview(
	record: ReviewRecord,
	handle: string = record.did
): ReviewCardModel | undefined {
	const creativeWorkType = getCreativeWorkType(record.value.creativeWorkType);
	const rawTmdbId = record.value.identifiers.tmdbId;
	if (!creativeWorkType || !rawTmdbId || !record.value.title) return undefined;

	const tmdbId = Number(rawTmdbId);
	if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return undefined;

	return {
		uri: record.uri,
		author: {
			did: record.did,
			handle
		},
		media: {
			creativeWorkType,
			tmdbId,
			title: record.value.title,
			poster: getPoster(record)
		},
		rating: record.value.rating,
		text: record.value.text ?? '',
		containsSpoilers: record.value.containsSpoilers ?? false,
		likeCount: record.likesCount ?? 0,
		commentCount: record.commentsCount ?? 0
	};
}

function getReviewAuthor(did: string, profiles: ReviewListRecords.ProfileEntry[]): ActorSummary {
	const bskyProfile = profiles.find(
		(profile) => profile.did === did && profile.collection === 'app.bsky.actor.profile'
	);
	const popfeedProfile = profiles.find(
		(profile) => profile.did === did && profile.collection === 'social.popfeed.actor.profile'
	);
	const profile = bskyProfile ?? popfeedProfile;
	const avatar =
		bskyProfile?.value && 'avatar' in bskyProfile.value ? bskyProfile.value.avatar : undefined;

	return {
		did,
		handle: profile?.handle ?? did,
		displayName: popfeedProfile?.value?.displayName ?? bskyProfile?.value?.displayName,
		avatarUrl: avatar ? getAtprotoCdnImageUrl({ did, blob: avatar, preset: 'avatar' }) : undefined
	};
}

function getCommentAuthor(
	did: string,
	profiles: Map<string, CommentListRecords.ProfileEntry>
): ActorSummary {
	const profile = profiles.get(did);
	const avatar = profile?.value && 'avatar' in profile.value ? profile.value.avatar : undefined;
	return {
		did,
		handle: profile?.handle ?? did,
		displayName: profile?.value?.displayName,
		avatarUrl: avatar ? getAtprotoCdnImageUrl({ did, blob: avatar, preset: 'avatar' }) : undefined
	};
}

type CommentFilter = { rootUri: string } | { subjectUri: string };

async function getCommentRecords(filter: CommentFilter) {
	const records: CommentListRecords.Record[] = [];
	const profiles: CommentListRecords.ProfileEntry[] = [];
	let cursor: string | undefined;

	do {
		const response = await contrail.get('watch.atmo.comment.listRecords', {
			params: { ...filter, cursor, limit: 200, profiles: true }
		});
		if (!response.ok) {
			throw new Error(`Could not load review comments from Contrail (${response.status})`);
		}

		records.push(...response.data.records);
		profiles.push(...(response.data.profiles ?? []));
		cursor = response.data.cursor;
	} while (cursor);

	return { records, profiles };
}

async function getViewerLikeUri(reviewUri: string, viewerDid: Did | null) {
	if (!viewerDid) return null;

	const response = await contrail.get('watch.atmo.like.listRecords', {
		params: { actor: viewerDid, subjectUri: reviewUri, limit: 1 }
	});
	if (!response.ok) {
		throw new Error(`Could not load viewer review like from Contrail (${response.status})`);
	}
	return response.data.records[0]?.uri ?? null;
}

export async function getReviewInteractions(
	reviewUri: string,
	viewerDid: Did | null,
	likeCount: number
) {
	// Direct comments generally omit rootUri. Replies use the top-level comment as
	// their root, so load each direct comment's thread instead of scanning the
	// service's entire comment collection. Querying rootUri=reviewUri also keeps
	// comments from clients that use the review itself as the thread root.
	const [direct, rooted, viewerLikeUri] = await Promise.all([
		getCommentRecords({ subjectUri: reviewUri }),
		getCommentRecords({ rootUri: reviewUri }),
		getViewerLikeUri(reviewUri, viewerDid)
	]);
	const comments = new Map<string, CommentListRecords.Record>();
	const commentProfiles = new Map<string, CommentListRecords.ProfileEntry>();

	function addComments(page: Awaited<ReturnType<typeof getCommentRecords>>) {
		for (const comment of page.records) comments.set(comment.uri, comment);
		for (const profile of page.profiles) {
			if (!commentProfiles.has(profile.did) || profile.collection === 'app.bsky.actor.profile') {
				commentProfiles.set(profile.did, profile);
			}
		}
	}
	addComments(direct);
	addComments(rooted);

	const batchSize = 8;
	for (let index = 0; index < direct.records.length; index += batchSize) {
		const pages = await Promise.all(
			direct.records
				.slice(index, index + batchSize)
				.map((comment) => getCommentRecords({ rootUri: comment.uri }))
		);
		for (const page of pages) addComments(page);
	}

	const reviewComments: ReviewCommentModel[] = [...comments.values()]
		.map((comment) => ({
			uri: comment.uri,
			author: getCommentAuthor(comment.did, commentProfiles),
			text: comment.value.text,
			createdAt: comment.value.createdAt,
			parentUri: comment.value.subjectUri,
			rootUri: comment.value.rootUri ?? null
		}))
		.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

	return {
		likeCount,
		commentCount: reviewComments.length,
		viewerLikeUri,
		comments: reviewComments
	};
}

export async function getRecentReviewsPage({
	cursor,
	limit,
	viewerDid
}: {
	cursor?: string;
	limit: number;
	viewerDid?: Did | null;
}): Promise<ReviewFeedPage> {
	const response = await contrail.get(WRITTEN_REVIEW_LIST_METHOD, {
		params: {
			cursor,
			limit,
			order: 'desc',
			profiles: true,
			...(viewerDid ? { hydrateLikes: 50 } : {})
		}
	});

	if (!response.ok) {
		throw new Error(`Could not load recent reviews from Contrail (${response.status})`);
	}

	const profiles = response.data.profiles ?? [];
	const reviews = response.data.records.flatMap((record) => {
		const author = getReviewAuthor(record.did, profiles);
		const review = toReview(record, author.handle);
		if (!review?.text.trim()) return [];

		return [
			{
				...review,
				author,
				viewerLikeUri: record.likes?.find((like) => like.did === viewerDid)?.uri ?? null
			}
		];
	});

	return { reviews, cursor: response.data.cursor ?? null };
}

export async function getMediaRatingSummary(
	tmdbId: number,
	creativeWorkType: SupportedCreativeWorkType
): Promise<{ score: number | null; count: number }> {
	const response = await contrail.get(RATING_SUMMARY_METHOD, {
		params: { tmdbId, creativeWorkType }
	});
	if (!response.ok) {
		throw new Error(`Could not load media rating summary from Contrail (${response.status})`);
	}

	const score = response.data.score === undefined ? null : Number(response.data.score);
	return {
		score: score !== null && Number.isFinite(score) ? score : null,
		count: response.data.count
	};
}

export async function getProfileReviewsPage({
	actor,
	cursor,
	limit,
	viewerDid
}: {
	actor: ActorIdentifier;
	cursor?: string;
	limit: number;
	viewerDid?: Did | null;
}): Promise<ReviewFeedPage> {
	const response = await contrail.get(REVIEW_LIST_METHOD, {
		params: {
			actor,
			cursor,
			limit,
			order: 'desc',
			profiles: true,
			...(viewerDid ? { hydrateLikes: 50 } : {})
		}
	});
	if (!response.ok) {
		throw new Error(`Could not load profile reviews from Contrail (${response.status})`);
	}

	const profiles = response.data.profiles ?? [];
	const reviews = response.data.records.flatMap((record) => {
		const author = getReviewAuthor(record.did, profiles);
		const review = toReview(record, author.handle);
		return review
			? [
					{
						...review,
						author,
						viewerLikeUri: record.likes?.find((like) => like.did === viewerDid)?.uri ?? null
					}
				]
			: [];
	});

	return { reviews, cursor: response.data.cursor ?? null };
}

export async function getMediaReviewsPage({
	tmdbId,
	creativeWorkType,
	cursor,
	limit,
	viewerDid
}: {
	tmdbId: number;
	creativeWorkType: SupportedCreativeWorkType;
	cursor?: string;
	limit: number;
	viewerDid?: Did | null;
}): Promise<ReviewFeedPage> {
	const response = await contrail.get(WRITTEN_REVIEW_LIST_METHOD, {
		params: {
			creativeWorkType,
			identifiersTmdbId: String(tmdbId),
			cursor,
			limit,
			order: 'desc',
			profiles: true,
			...(viewerDid ? { hydrateLikes: 50 } : {})
		}
	});
	if (!response.ok) {
		throw new Error(`Could not load media reviews from Contrail (${response.status})`);
	}

	const profiles = response.data.profiles ?? [];
	const reviews = response.data.records.flatMap((record) => {
		const author = getReviewAuthor(record.did, profiles);
		const review = toReview(record, author.handle);
		if (
			!review?.text.trim() ||
			review.media.tmdbId !== tmdbId ||
			review.media.creativeWorkType !== creativeWorkType
		) {
			return [];
		}

		return [
			{
				...review,
				author,
				viewerLikeUri: record.likes?.find((like) => like.did === viewerDid)?.uri ?? null
			}
		];
	});

	return { reviews, cursor: response.data.cursor ?? null };
}
