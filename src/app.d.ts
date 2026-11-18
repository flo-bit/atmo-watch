/// <reference types="@cloudflare/workers-types" />
// See https://svelte.dev/docs/kit/types#app.d.ts
import type { OAuthSession } from '@atcute/oauth-node-client';
import type { Client } from '@atcute/client';
import type { Did } from '@atcute/lexicons';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: OAuthSession | null;
			client: Client | null;
			did: Did | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				ASSETS?: Fetcher;
				OG_IMAGES?: R2Bucket;
				OG_DAILY_GENERATION_LIMIT?: string;
				OG_DAILY_SOCIAL_RESERVE?: string;
				OG_CYCLE_GENERATION_LIMIT?: string;
				OG_BILLING_CYCLE_START_DAY?: string;
				CRON_SECRET?: string;
			};
			context: ExecutionContext;
		}
	}
}

export {};
