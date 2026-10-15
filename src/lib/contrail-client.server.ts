import { env } from '$env/dynamic/private';
import { createPublicServiceClient } from '@atmo-dev/contrail/client';
import { contrailApi, contrailTarget } from '$lib/contrail/index.js';
import { fetchWithDeadline } from '$lib/upstream.server';

const localEndpoint = env.CONTRAIL_URL;

// Retain the generated target/auth contract. Only the transport changes: a
// stalled API (including its response body) cannot hold SSR open indefinitely.
export const contrail = createPublicServiceClient({
	...(localEndpoint
		? {
				endpoint: localEndpoint,
				allowInsecureHttp: true,
				serviceMethods: contrailApi.serviceMethods,
				collections: contrailApi.collections,
				notifyMethod: contrailApi.notifyMethod
			}
		: contrailTarget),
	fetch: fetchWithDeadline
});
