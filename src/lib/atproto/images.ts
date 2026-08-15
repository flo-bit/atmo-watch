import { isBlob, type Blob, type LegacyBlob } from '@atcute/lexicons/interfaces';
import { getCDNImageBlobUrl, type CDNPreset } from '@svelte-atproto/oauth/bsky';

export function getAtprotoCdnImageUrl({
	did,
	blob,
	preset
}: {
	did: string;
	blob: Blob | LegacyBlob;
	preset: CDNPreset;
}) {
	const normalizedBlob = isBlob(blob)
		? blob
		: {
				$type: 'blob' as const,
				ref: { $link: blob.cid }
			};

	return getCDNImageBlobUrl({ did, blob: normalizedBlob, preset });
}
