import { beforeEach, describe, expect, it, vi } from 'vitest';
const runIngestion = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/contrail/cron', () => ({ runIngestion }));
import { POST } from './+server';

function invoke(secret?: string, header?: string) {
	return POST({
		request: new Request('http://localhost/api/cron', {
			method: 'POST',
			headers: header ? { 'X-Cron-Secret': header } : {}
		}),
		platform: { env: { DB: {}, CRON_SECRET: secret } }
	} as Parameters<typeof POST>[0]);
}

beforeEach(() => {
	runIngestion.mockReset();
});

describe('cron authentication and failure reporting', () => {
	it('rejects missing/unconfigured/wrong secrets before touching storage', async () => {
		for (const [secret, header] of [
			[undefined, undefined],
			['secret', undefined],
			['secret', 'wrong']
		]) {
			expect((await invoke(secret, header)).status).toBe(401);
		}
		expect(runIngestion).not.toHaveBeenCalled();
	});

	it('accepts the scheduled secret and returns a failure status when ingestion fails', async () => {
		expect((await invoke('secret', 'secret')).status).toBe(200);
		expect(runIngestion).toHaveBeenCalledOnce();
		runIngestion.mockRejectedValueOnce(new Error('stale cursor'));
		expect((await invoke('secret', 'secret')).status).toBe(503);
	});
});
