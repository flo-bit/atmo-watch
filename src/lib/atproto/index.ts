// Side-effect: loads `com.atproto.*` lexicon types into the atcute Client.
import '@atcute/atproto';
import { createAtprotoAuth } from '@svelte-atproto/oauth/server';
import { cloudflareKV } from '@svelte-atproto/oauth/server/stores/cloudflare';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { contrail } from '$lib/contrail-client.server';

// To enable signup, add: signupPDS: 'https://your-pds.example/'
export const atproto = createAtprotoAuth({
	origin: env.ORIGIN,
	// Cloudflare runtime secrets are unavailable while SvelteKit analyses the build.
	cookieSecret: env.COOKIE_SECRET || (building ? 'build-only-cookie-secret' : undefined),
	clientAssertionKey: env.CLIENT_ASSERTION_KEY,
	scope: [
		'atproto repo:social.popfeed.feed.review repo:social.popfeed.feed.comment repo:social.popfeed.feed.like repo:social.popfeed.feed.list repo:social.popfeed.feed.listItem blob:*/*',
		contrail.scope
	]
		.filter(Boolean)
		.join(' '),
	sessions: cloudflareKV('OAUTH_SESSIONS'),
	states: cloudflareKV('OAUTH_STATES', { ttl: 600 })
});
