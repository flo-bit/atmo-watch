import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { cloudflareKV } from '@svelte-atproto/oauth/server/stores/cloudflare';
import type { SupportedCreativeWorkType } from '$lib/types';

const KV_BINDING = 'MEDIA_CACHE';
const KEY_PREFIX = 'media-curation:v1';
const REVISION_KEY = `${KEY_PREFIX}:revision`;
const PRIMARY_CURATOR_DID = 'did:plc:257wekqxg4hyapkq6k47igmp';

export type MediaArtworkOverride = {
	backdropPath: string | null;
	logoPath: string | null;
	updatedBy: string;
	updatedAt: string;
};

const getKvStore = cloudflareKV<string, unknown>(KV_BINDING);
const developmentStore = new Map<string, unknown>();

function overrideKey(creativeWorkType: SupportedCreativeWorkType, tmdbId: number) {
	return `${KEY_PREFIX}:${creativeWorkType}:${tmdbId}`;
}

function isOverride(value: unknown): value is MediaArtworkOverride {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Record<string, unknown>;
	return (
		(candidate.backdropPath === null || typeof candidate.backdropPath === 'string') &&
		(candidate.logoPath === null || typeof candidate.logoPath === 'string') &&
		typeof candidate.updatedBy === 'string' &&
		typeof candidate.updatedAt === 'string'
	);
}

async function readValue(key: string) {
	const store = getKvStore();
	if (store) return store.get(key);
	return dev ? developmentStore.get(key) : undefined;
}

async function writeValue(key: string, value: unknown) {
	const store = getKvStore();
	if (store) {
		await store.set(key, value);
		return;
	}
	if (!dev) throw new Error(`${KV_BINDING} is not available`);
	developmentStore.set(key, value);
}

async function deleteValue(key: string) {
	const store = getKvStore();
	if (store) {
		await store.delete(key);
		return;
	}
	if (!dev) throw new Error(`${KV_BINDING} is not available`);
	developmentStore.delete(key);
}

export function isMediaArtworkCurator(did: string | null | undefined) {
	if (!did) return false;
	const configuredDids = (env.MEDIA_CURATOR_DIDS ?? '')
		.split(/[\s,]+/)
		.map((value) => value.trim())
		.filter(Boolean);
	return did === PRIMARY_CURATOR_DID || configuredDids.includes(did);
}

export async function getMediaArtworkOverride(
	creativeWorkType: SupportedCreativeWorkType,
	tmdbId: number
): Promise<MediaArtworkOverride | null> {
	try {
		const value = await readValue(overrideKey(creativeWorkType, tmdbId));
		return isOverride(value) ? value : null;
	} catch (cause) {
		console.error(`Could not load artwork override for ${creativeWorkType} ${tmdbId}`, cause);
		return null;
	}
}

export async function getMediaArtworkRevision() {
	try {
		const value = await readValue(REVISION_KEY);
		return typeof value === 'string' && value ? value : '0';
	} catch {
		return '0';
	}
}

export async function setMediaArtworkOverride({
	creativeWorkType,
	tmdbId,
	backdropPath,
	logoPath,
	updatedBy
}: {
	creativeWorkType: SupportedCreativeWorkType;
	tmdbId: number;
	backdropPath: string | null;
	logoPath: string | null;
	updatedBy: string;
}) {
	const updatedAt = new Date().toISOString();
	const key = overrideKey(creativeWorkType, tmdbId);
	let override: MediaArtworkOverride | null = null;

	if (backdropPath === null && logoPath === null) {
		await deleteValue(key);
	} else {
		override = { backdropPath, logoPath, updatedBy, updatedAt };
		await writeValue(key, override);
	}

	// Changing the revision gives caches containing resolved artwork a new key.
	await writeValue(REVISION_KEY, updatedAt);
	return { override, revision: updatedAt };
}
