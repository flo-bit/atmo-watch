import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { createTID } from '@svelte-atproto/oauth/helper';
import { isCanonicalResourceUri, parseCanonicalResourceUri } from '@atcute/lexicons';
import type { CanonicalResourceUri } from '@atcute/lexicons';
import * as v from 'valibot';
import { contrail } from '$lib/contrail-client.server';
import type { Main as CommentRecord } from '$lib/contrail/types/types/social/popfeed/feed/comment';

const REVIEW_COLLECTION = 'social.popfeed.feed.review';
const COMMENT_COLLECTION = 'social.popfeed.feed.comment';

const uriSchema = v.pipe(
	v.string(),
	v.maxLength(500),
	v.check((value: string) => isCanonicalResourceUri(value), 'Invalid AT URI')
);

const createCommentSchema = v.object({
	reviewUri: uriSchema,
	parentUri: v.optional(uriSchema),
	rootUri: v.optional(uriSchema),
	text: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1000))
});

function requireUri(value: string, collection: string): CanonicalResourceUri {
	if (!isCanonicalResourceUri(value)) error(400, 'Invalid AT URI');
	const parsed = parseCanonicalResourceUri(value);
	if (parsed.collection !== collection) error(400, 'Invalid record collection');
	return value;
}

function responseMessage(data: unknown, fallback: string) {
	if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
		return data.message;
	}
	return fallback;
}

export const createReviewComment = command(
	createCommentSchema,
	async ({ reviewUri, parentUri, rootUri, text }) => {
		const { locals } = getRequestEvent();
		if (!locals.client || !locals.did) error(401, 'Log in to comment');

		const review = requireUri(reviewUri, REVIEW_COLLECTION);
		const parent = parentUri ? requireUri(parentUri, COMMENT_COLLECTION) : undefined;
		const root = parent ? requireUri(rootUri ?? parent, COMMENT_COLLECTION) : undefined;
		if (!parent && rootUri) error(400, 'A top-level comment cannot have a comment root');

		const createdAt = new Date().toISOString();
		const record = {
			$type: COMMENT_COLLECTION,
			createdAt,
			facets: [],
			subjectUri: parent ?? review,
			subjectType: parent ? 'comment' : 'review',
			...(root ? { rootUri: root } : {}),
			text
		} as CommentRecord;

		const response = await contrail
			.authenticated(locals.client)
			.post('com.atproto.repo.createRecord', {
				input: {
					repo: locals.did,
					collection: COMMENT_COLLECTION,
					rkey: createTID(),
					record
				}
			});
		if (!response.ok) {
			error(response.status, responseMessage(response.data, 'Could not post comment'));
		}

		return {
			uri: response.data.uri,
			did: locals.did,
			text,
			createdAt,
			parentUri: parent ?? review,
			rootUri: root ?? null
		};
	}
);
