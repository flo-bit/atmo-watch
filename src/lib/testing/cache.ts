import { vi } from 'vitest';

/** Small Cache API stand-in with expiring entries and independently readable bodies. */
export function installTestCache() {
	const entries = new Map<
		string,
		{ body: ArrayBuffer; headers: [string, string][]; status: number; expiresAt: number }
	>();
	const cache = {
		match: vi.fn(async (request: Request) => {
			const entry = entries.get(request.url);
			if (!entry || entry.expiresAt <= Date.now()) return undefined;
			return new Response(entry.body, { headers: entry.headers, status: entry.status });
		}),
		put: vi.fn(async (request: Request, response: Response) => {
			const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]);
			entries.set(request.url, {
				body: await response.arrayBuffer(),
				headers: [...response.headers.entries()],
				status: response.status,
				expiresAt: Date.now() + maxAge * 1000
			});
		})
	};
	vi.stubGlobal('caches', { default: cache });
	return { cache, entries };
}
