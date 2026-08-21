import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { isCanonicalResourceUri, parseCanonicalResourceUri } from '@atcute/lexicons';
import type { CanonicalResourceUri, Did } from '@atcute/lexicons';
import { createTID } from '@svelte-atproto/oauth/helper';
import * as v from 'valibot';
import { contrail } from '$lib/contrail-client.server';

const REVIEW_COLLECTION = 'social.popfeed.feed.review';
const LIKE_COLLECTION = 'social.popfeed.feed.like';

const uriSchema = v.pipe(
	v.string(),
	v.maxLength(500),
	v.check((value: string) => isCanonicalResourceUri(value), 'Invalid AT URI')
);

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

async function findLike(reviewUri: CanonicalResourceUri, did: Did) {
	let cursor: string | undefined;

	do {
		const response = await contrail.get('watch.atmo.like.listRecords', {
			params: { actor: did, cursor, limit: 200 }
		});
		if (!response.ok) return null;

		const like = response.data.records.find((record) => record.value.subjectUri === reviewUri);
		if (like) return like.uri;
		cursor = response.data.cursor;
	} while (cursor);

	return null;
}

export const likeReview = command(v.object({ reviewUri: uriSchema }), async ({ reviewUri }) => {
	const { locals } = getRequestEvent();
	const { client, did } = locals;
	if (!client || !did) error(401, 'Log in to like this review');

	const subjectUri = requireUri(reviewUri, REVIEW_COLLECTION);
	const existing = await findLike(subjectUri, did);
	if (existing) return { uri: existing, created: false };

	const response = await contrail.authenticated(client).post('com.atproto.repo.createRecord', {
		input: {
			repo: did,
			collection: LIKE_COLLECTION,
			rkey: createTID(),
			record: {
				$type: LIKE_COLLECTION,
				subjectUri,
				subjectType: 'review',
				createdAt: new Date().toISOString()
			}
		}
	});

	if (!response.ok) {
		error(response.status, responseMessage(response.data, 'Could not like review'));
	}

	return { uri: response.data.uri, created: true };
});

export const unlikeReview = command(
	v.object({ reviewUri: uriSchema, likeUri: uriSchema }),
	async ({ reviewUri, likeUri }) => {
		const { locals } = getRequestEvent();
		const { client, did } = locals;
		if (!client || !did) error(401, 'Log in to unlike this review');

		const subjectUri = requireUri(reviewUri, REVIEW_COLLECTION);
		const parsedLike = parseCanonicalResourceUri(requireUri(likeUri, LIKE_COLLECTION));
		if (parsedLike.repo !== did) error(403, 'You can only remove your own like');

		const existing = await client.get('com.atproto.repo.getRecord', {
			params: { repo: did, collection: LIKE_COLLECTION, rkey: parsedLike.rkey }
		});
		if (!existing.ok) {
			error(existing.status, responseMessage(existing.data, 'Could not find like'));
		}

		const value = existing.data.value as { $type?: unknown; subjectUri?: unknown };
		if (value.$type !== LIKE_COLLECTION || value.subjectUri !== subjectUri) {
			error(400, 'Like does not belong to this review');
		}

		const response = await contrail.authenticated(client).post('com.atproto.repo.deleteRecord', {
			input: { repo: did, collection: LIKE_COLLECTION, rkey: parsedLike.rkey },
			as: null
		});
		if (!response.ok) {
			error(response.status, responseMessage(response.data, 'Could not remove like'));
		}

		return { deleted: true };
	}
);
