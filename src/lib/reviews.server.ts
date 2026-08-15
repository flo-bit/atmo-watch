import { getAtprotoCdnImageUrl } from '$lib/atproto/images';
import { contrail } from '$lib/contrail';
import type * as CommentListRecords from '$lib/contrail/types/types/watch/atmo/comment/listRecords';
import type * as LikeListRecords from '$lib/contrail/types/types/watch/atmo/like/listRecords';
import type * as ReviewListRecords from '$lib/contrail/types/types/watch/atmo/review/listRecords';
import type {
	ActorSummary,
	MediaImage,
	ReviewCardModel,
	ReviewCommentModel,
	SupportedCreativeWorkType
} from '$lib/types';

type ReviewRecord = Pick<ReviewListRecords.Record, 'uri' | 'did' | 'value'>;

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
		likeCount: 0,
		commentCount: 0
	};
}

async function listAllLikes() {
	const records: LikeListRecords.Record[] = [];
	let cursor: string | undefined;

	do {
		const response = await contrail.get('watch.atmo.like.listRecords', {
			params: { cursor, limit: 200 }
		});
		if (!response.ok) {
			throw new Error(`Could not load review likes from Contrail (${response.status})`);
		}
		records.push(...response.data.records);
		cursor = response.data.cursor;
	} while (cursor);

	return records;
}

async function listAllComments() {
	const records: CommentListRecords.Record[] = [];
	let cursor: string | undefined;

	do {
		const response = await contrail.get('watch.atmo.comment.listRecords', {
			params: { cursor, limit: 200 }
		});
		if (!response.ok) {
			throw new Error(`Could not load review comments from Contrail (${response.status})`);
		}
		records.push(...response.data.records);
		cursor = response.data.cursor;
	} while (cursor);

	return records;
}

export async function withReviewInteractionCounts(
	reviews: ReviewCardModel[]
): Promise<ReviewCardModel[]> {
	const targetUris = new Set(
		reviews.filter((review) => review.text.trim()).map((review) => review.uri)
	);
	if (targetUris.size === 0) return reviews;

	try {
		const [likes, comments] = await Promise.all([listAllLikes(), listAllComments()]);
		const likersByReview = new Map<string, Set<string>>();
		for (const like of likes) {
			if (!targetUris.has(like.value.subjectUri)) continue;
			const likers = likersByReview.get(like.value.subjectUri) ?? new Set<string>();
			likers.add(like.did);
			likersByReview.set(like.value.subjectUri, likers);
		}

		const reviewByThreadUri = new Map<string, string>();
		for (const uri of targetUris) reviewByThreadUri.set(uri, uri);
		const commentCounts = new Map<string, number>();
		const countedComments = new Set<string>();
		let foundComments = true;
		while (foundComments) {
			foundComments = false;
			for (const comment of comments) {
				if (countedComments.has(comment.uri)) continue;
				const reviewUri =
					reviewByThreadUri.get(comment.value.subjectUri) ??
					(comment.value.rootUri ? reviewByThreadUri.get(comment.value.rootUri) : undefined);
				if (!reviewUri) continue;

				countedComments.add(comment.uri);
				reviewByThreadUri.set(comment.uri, reviewUri);
				commentCounts.set(reviewUri, (commentCounts.get(reviewUri) ?? 0) + 1);
				foundComments = true;
			}
		}

		return reviews.map((review) => ({
			...review,
			likeCount: likersByReview.get(review.uri)?.size ?? 0,
			commentCount: commentCounts.get(review.uri) ?? 0
		}));
	} catch (cause) {
		console.error('Could not load review interaction counts from Contrail', cause);
		return reviews;
	}
}

function getCommentAuthor(
	did: string,
	profiles: Map<string, CommentListRecords.ProfileEntry>
): ActorSummary {
	const profile = profiles.get(did);
	return {
		did,
		handle: profile?.handle ?? did,
		displayName: profile?.value?.displayName,
		avatarUrl: profile?.value?.avatar
			? getAtprotoCdnImageUrl({ did, blob: profile.value.avatar, preset: 'avatar' })
			: undefined
	};
}

export async function getReviewInteractions(reviewUri: string, viewerDid: string | null) {
	const likes: LikeListRecords.Record[] = [];
	const comments: CommentListRecords.Record[] = [];
	const commentProfiles = new Map<string, CommentListRecords.ProfileEntry>();
	let likeCursor: string | undefined;
	let commentCursor: string | undefined;

	do {
		const response = await contrail.get('watch.atmo.like.listRecords', {
			params: { cursor: likeCursor, limit: 200 }
		});
		if (!response.ok) {
			throw new Error(`Could not load review likes from Contrail (${response.status})`);
		}

		likes.push(...response.data.records.filter((record) => record.value.subjectUri === reviewUri));
		likeCursor = response.data.cursor;
	} while (likeCursor);

	do {
		const response = await contrail.get('watch.atmo.comment.listRecords', {
			params: { cursor: commentCursor, limit: 200, profiles: true }
		});
		if (!response.ok) {
			throw new Error(`Could not load review comments from Contrail (${response.status})`);
		}

		comments.push(...response.data.records);
		for (const profile of response.data.profiles ?? []) {
			if (!commentProfiles.has(profile.did) || profile.collection === 'app.bsky.actor.profile') {
				commentProfiles.set(profile.did, profile);
			}
		}
		commentCursor = response.data.cursor;
	} while (commentCursor);

	const uniqueLikers = new Set(likes.map((like) => like.did));
	const viewerLikeUri = viewerDid
		? (likes.find((like) => like.did === viewerDid)?.uri ?? null)
		: null;

	const threadUris = new Set([reviewUri]);
	const threadComments: CommentListRecords.Record[] = [];
	let foundComments = true;
	while (foundComments) {
		foundComments = false;
		for (const comment of comments) {
			if (threadUris.has(comment.uri)) continue;
			if (
				threadUris.has(comment.value.subjectUri) ||
				(comment.value.rootUri && threadUris.has(comment.value.rootUri))
			) {
				threadUris.add(comment.uri);
				threadComments.push(comment);
				foundComments = true;
			}
		}
	}

	const reviewComments: ReviewCommentModel[] = threadComments
		.map((comment) => ({
			uri: comment.uri,
			author: getCommentAuthor(comment.did, commentProfiles),
			text: comment.value.text,
			createdAt: comment.value.createdAt
		}))
		.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

	return {
		likeCount: uniqueLikers.size,
		commentCount: reviewComments.length,
		viewerLikeUri,
		comments: reviewComments
	};
}

export async function getMediaReviews(
	tmdbId: number,
	creativeWorkType: SupportedCreativeWorkType
): Promise<ReviewCardModel[]> {
	const params = {
		creativeWorkType,
		identifiersTmdbId: String(tmdbId),
		limit: 200,
		profiles: true
	};
	const response = await contrail.get('watch.atmo.review.listRecords', { params });

	if (!response.ok) {
		throw new Error(`Could not load reviews from Contrail (${response.status})`);
	}

	const handles = new Map(
		(response.data.profiles ?? []).map((profile) => [profile.did, profile.handle ?? profile.did])
	);

	const reviews = response.data.records.flatMap((record) => {
		const review = toReview(record, handles.get(record.did));
		return review?.media.tmdbId === tmdbId && review.media.creativeWorkType === creativeWorkType
			? [review]
			: [];
	});

	return withReviewInteractionCounts(reviews);
}
