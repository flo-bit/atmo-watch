export class DeadlineError extends Error {
	constructor(label: string) {
		super(`${label} timed out`);
		this.name = 'DeadlineError';
	}
}

/**
 * Bound both network work and non-cancellable platform/cache calls. Operations
 * receive a signal: fetches must use it. KV/Cache API calls cannot be cancelled;
 * bounding their await does not claim to stop the platform operation.
 */
export async function withTimeout<T>(
	label: string,
	timeoutMs: number,
	operation: (signal: AbortSignal) => PromiseLike<T> | T,
	parent?: AbortSignal | null
): Promise<T> {
	const controller = new AbortController();
	const abortFromParent = () => controller.abort(parent?.reason);
	if (parent?.aborted) abortFromParent();
	else parent?.addEventListener('abort', abortFromParent, { once: true });
	const timer = setTimeout(() => controller.abort(new DeadlineError(label)), timeoutMs);
	let rejectAbort: (() => void) | undefined;
	try {
		controller.signal.throwIfAborted();
		const aborted = new Promise<never>((_, reject) => {
			rejectAbort = () => reject(controller.signal.reason);
			controller.signal.addEventListener('abort', rejectAbort, { once: true });
		});
		return await Promise.race([
			Promise.resolve().then(() => {
				controller.signal.throwIfAborted();
				return operation(controller.signal);
			}),
			aborted
		]);
	} finally {
		clearTimeout(timer);
		if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
		parent?.removeEventListener('abort', abortFromParent);
	}
}

/** JSON APIs: bound headers AND body transfer, not just receipt of headers. */
export async function fetchWithDeadline(
	input: RequestInfo | URL,
	init?: RequestInit,
	timeoutMs = 3_000
): Promise<Response> {
	const parent = init?.signal ?? (input instanceof Request ? input.signal : undefined);
	return withTimeout(
		'Upstream request',
		timeoutMs,
		async (signal) => {
			const response = await fetch(input, { ...init, signal });
			const body = await response.arrayBuffer();
			const result = new Response(
				response.status === 204 ||
					response.status === 205 ||
					response.status === 304 ||
					init?.method === 'HEAD'
					? null
					: body,
				{ status: response.status, statusText: response.statusText, headers: response.headers }
			);
			// Preserve redirect/discovery checks in Contrail's public-service client.
			Object.defineProperty(result, 'url', { value: response.url });
			Object.defineProperty(result, 'redirected', { value: response.redirected });
			return result;
		},
		parent
	);
}
