import { env } from '$env/dynamic/private';
import { TMDBError } from '@lorenzopant/tmdb';
import { fetchWithDeadline } from '$lib/upstream.server';

/**
 * The TMDB SDK doesn't accept AbortSignal or an injectable fetch. Use bounded
 * direct GETs for homepage-critical calls instead of racing an uncancellable
 * SDK request (which would also poison its in-flight deduplication map).
 */
export async function getTmdbJson<T>(
	path: string,
	params: Record<string, string | number> = {},
	signal?: AbortSignal
): Promise<T> {
	const token = env.TMDB_ACCESS_TOKEN ?? env.TMDB_API_KEY;
	if (!token) throw new Error('TMDB_ACCESS_TOKEN is not configured');
	const url = new URL(`https://api.themoviedb.org/3/${path}`);
	url.searchParams.set('language', 'en-US');
	url.searchParams.set('region', 'US');
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
	const headers = new Headers({ Accept: 'application/json' });
	// Support the existing read-access token and v3 API-key configurations.
	if (token.includes('.')) headers.set('Authorization', `Bearer ${token}`);
	else url.searchParams.set('api_key', token);

	const response = await fetchWithDeadline(url, { headers, signal }, 2_500);
	if (!response.ok) {
		// Avoid logging credential-bearing URLs or upstream response text.
		throw new TMDBError(`TMDB request failed with HTTP ${response.status}`, response.status);
	}
	return (await response.json()) as T;
}
