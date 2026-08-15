import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { atproto } from '$lib/atproto';
import { createTID } from '@svelte-atproto/oauth/helper';

export const oauthLogin = command(
	v.object({
		handle: v.optional(v.pipe(v.string(), v.minLength(3))),
		signup: v.optional(v.boolean()),
		returnTo: v.optional(v.string())
	}),
	(input) => atproto.api.startLogin(input)
);

export const oauthLogout = command(() => atproto.api.logout());
