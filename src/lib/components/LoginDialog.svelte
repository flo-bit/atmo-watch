<script lang="ts">
	import { page } from '$app/state';
	import { oauthLogin } from '$lib/atproto/oauth.remote';
	import { loginDialog } from '$lib/login.svelte';
	import { AtprotoLoginModal } from '@foxui/social';

	$effect(() => {
		if (page.url.pathname) loginDialog.hide();
	});

	async function login(handle: string) {
		const returnTo = page.url.pathname + page.url.search + page.url.hash;
		const { url } = await oauthLogin({ handle: handle.trim(), returnTo });
		window.location.assign(url);
		return true;
	}
</script>

<AtprotoLoginModal bind:open={loginDialog.open} {login} />
