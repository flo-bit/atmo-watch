import { getCDNImageBlobUrl, type CDNPreset } from '@svelte-atproto/oauth/bsky';

function getBlobCid(value: unknown): string | undefined {
	if (typeof value === 'string') {
		try {
			return getBlobCid(JSON.parse(value));
		} catch {
			return undefined;
		}
	}

	if (!value || typeof value !== 'object') return undefined;

	const blob = value as {
		ref?: { $link?: unknown };
		cid?: unknown;
		original?: unknown;
	};
	if (typeof blob.ref?.$link === 'string') return blob.ref.$link;
	if (typeof blob.cid === 'string') return blob.cid;
	return getBlobCid(blob.original);
}

export function getAtprotoCdnImageUrl({
	did,
	blob,
	preset
}: {
	did: string;
	blob: unknown;
	preset: CDNPreset;
}) {
	const cid = getBlobCid(blob);
	if (!cid) return undefined;

	return getCDNImageBlobUrl({
		did,
		blob: { $type: 'blob', ref: { $link: cid } },
		preset
	});
}
