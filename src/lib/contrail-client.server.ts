import { getRequestEvent } from '$app/server';
import { createEmbeddedClient } from '$lib/server/contrail/client';

// Resolve the binding for each request; never capture build-time env or fall
// back to the retired API when local storage is unavailable.
export const contrail = createEmbeddedClient(() => {
	const db = getRequestEvent().platform?.env.DB;
	if (!db) throw new Error('Contrail requires the Cloudflare DB binding');
	return db;
});
