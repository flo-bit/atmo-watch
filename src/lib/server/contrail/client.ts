import type {} from '$lib/contrail/types';
import type { Nsid } from '@atcute/lexicons';
import { createPublicServiceClient } from '@atmo-dev/contrail/client';
import { config } from '$lib/contrail.config';
import { lexicons } from '../../../../lexicons/generated';
import { handleContrailRequest } from './runtime';

const serviceMethods = (lexicons as { id: Nsid; defs: Record<string, { type?: string }> }[])
	.filter((doc) => {
		const main = doc.defs.main;
		return main?.type === 'query' || main?.type === 'procedure';
	})
	.map((doc) => doc.id as Nsid);
const collections = [
	...Object.values(config.collections).map((collection) => collection.collection),
	...(config.profiles ?? []).map((profile) =>
		typeof profile === 'string' ? profile : profile.collection
	)
] as Nsid[];

/** Keep the PDS-write/notify helper, but route AppView calls in-process. No
 * service token or HTTP roundtrip is needed inside the application's Worker. */
export function createEmbeddedClient(getDb: () => D1Database) {
	return createPublicServiceClient({
		endpoint: 'https://atmo.watch',
		serviceMethods,
		collections,
		notifyMethod: 'watch.atmo.notifyOfUpdate',
		fetch: (input, init) => handleContrailRequest(new Request(input, init), getDb())
	});
}
