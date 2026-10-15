import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeadlineError, fetchWithDeadline, withTimeout } from './upstream.server';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('bounded upstream transport', () => {
	it('consumes successful bodies and preserves URLs used by service discovery checks', async () => {
		const response = Response.json({ ok: true });
		Object.defineProperty(response, 'url', { value: 'https://api.example.test/xrpc/query' });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		const result = await fetchWithDeadline('https://api.example.test/xrpc/query');
		expect(await result.json()).toEqual({ ok: true });
		expect(result.url).toBe(response.url);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('aborts a stalled fetch, rejects even if a transport ignores abort, and clears its timer', async () => {
		let signal: AbortSignal | undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn((_input: unknown, init: RequestInit) => {
				signal = init.signal ?? undefined;
				return new Promise<Response>(() => {});
			})
		);
		const pending = fetchWithDeadline('https://api.example.test/');
		const rejected = expect(pending).rejects.toBeInstanceOf(DeadlineError);
		await vi.advanceTimersByTimeAsync(3_000);
		await rejected;
		expect(signal?.aborted).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('bounds body transfer, not just headers', async () => {
		let streamController: ReadableStreamDefaultController<Uint8Array>;
		vi.stubGlobal(
			'fetch',
			vi.fn((_input: unknown, init: RequestInit) => {
				const body = new ReadableStream<Uint8Array>({
					start(controller) {
						streamController = controller;
						controller.enqueue(new TextEncoder().encode('{'));
					}
				});
				init.signal?.addEventListener('abort', () => streamController.error(init.signal?.reason));
				return Promise.resolve(new Response(body));
			})
		);
		const pending = fetchWithDeadline('https://api.example.test/');
		const rejected = expect(pending).rejects.toBeInstanceOf(DeadlineError);
		await vi.advanceTimersByTimeAsync(3_000);
		await rejected;
		expect(vi.getTimerCount()).toBe(0);
	});

	it('propagates a parent deadline to the real fetch', async () => {
		const parent = new AbortController();
		let signal: AbortSignal | undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn((_input: unknown, init: RequestInit) => {
				signal = init.signal ?? undefined;
				return new Promise<Response>(() => {});
			})
		);
		const pending = fetchWithDeadline('https://api.example.test/', { signal: parent.signal });
		const rejected = expect(pending).rejects.toThrow('Page deadline');
		await vi.advanceTimersByTimeAsync(1);
		parent.abort(new Error('Page deadline'));
		await rejected;
		expect(signal?.aborted).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not start a fetch when its parent has already expired', async () => {
		const parent = new AbortController();
		parent.abort(new Error('Expired'));
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		await expect(
			fetchWithDeadline('https://api.example.test/', { signal: parent.signal })
		).rejects.toThrow('Expired');
		expect(fetcher).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('clears timers after an upstream rejection and allows a later retry', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockRejectedValueOnce(new Error('Network failed'))
				.mockResolvedValueOnce(Response.json({ recovered: true }))
		);
		await expect(fetchWithDeadline('https://api.example.test/')).rejects.toThrow('Network failed');
		expect(await (await fetchWithDeadline('https://api.example.test/')).json()).toEqual({
			recovered: true
		});
		expect(vi.getTimerCount()).toBe(0);
	});

	it('bounds non-cancellable work without promising cancellation', async () => {
		const pending = withTimeout('KV read', 750, () => new Promise(() => {}));
		const rejected = expect(pending).rejects.toThrow('KV read timed out');
		await vi.advanceTimersByTimeAsync(750);
		await rejected;
		expect(vi.getTimerCount()).toBe(0);
	});
});
