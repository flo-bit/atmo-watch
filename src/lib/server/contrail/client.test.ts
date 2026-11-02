import { Client } from '@atcute/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ handleContrailRequest: handle }));
import { createEmbeddedClient } from './client';

beforeEach(() => {
	handle.mockReset();
});

describe('embedded client transport', () => {
	it('reads from the current D1 binding with no global network fetch', async () => {
		const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected HTTP'));
		try {
			let db = {} as D1Database;
			const client = createEmbeddedClient(() => db);
			handle.mockImplementation(async () => Response.json({ records: [] }));
			expect((await client.get('watch.atmo.review.listRecords', { params: {} })).ok).toBe(true);
			expect(handle.mock.calls[0][1]).toBe(db);
			expect((handle.mock.calls[0][0] as Request).url).toContain(
				'/xrpc/watch.atmo.review.listRecords'
			);
			db = {} as D1Database;
			await client.get('watch.atmo.review.listRecords', { params: {} });
			expect(handle.mock.calls[1][1]).toBe(db);
			expect(client.scope).toBeNull();
			expect(network).not.toHaveBeenCalled();
		} finally {
			network.mockRestore();
		}
	});

	it('sends writes to the PDS and notifies the embedded AppView without minting a service token', async () => {
		const uri = 'at://did:plc:abc/social.popfeed.feed.review/test';
		const pds = vi.fn().mockImplementation(async () => Response.json({ uri, cid: 'cid' }));
		const client = createEmbeddedClient(() => ({}) as D1Database).authenticated(
			new Client({ handler: pds })
		);
		handle.mockImplementation(async () => Response.json({ errors: [] }));
		const response = await client.post('com.atproto.repo.createRecord', {
			input: {
				repo: 'did:plc:abc',
				collection: 'social.popfeed.feed.review',
				record: { text: 'test' }
			}
		});
		expect(response.ok).toBe(true);
		expect(pds).toHaveBeenCalledTimes(1);
		expect(pds.mock.calls[0][0]).toContain('com.atproto.repo.createRecord');
		expect(handle).toHaveBeenCalledTimes(1);
		const request = handle.mock.calls[0][0] as Request;
		expect(request.url).toBe('https://atmo.watch/xrpc/watch.atmo.notifyOfUpdate');
		expect(await request.json()).toEqual({ uris: [uri] });
		expect(request.headers.has('authorization')).toBe(false);
	});

	it('does not fail a committed PDS write when notification fails', async () => {
		const pds = new Client({
			handler: async () =>
				Response.json({ uri: 'at://did:plc:abc/social.popfeed.feed.review/test', cid: 'cid' })
		});
		const onNotificationError = vi.fn();
		const client = createEmbeddedClient(() => ({}) as D1Database).authenticated(pds, {
			onNotificationError
		});
		handle.mockRejectedValue(new Error('D1 unavailable'));
		expect(
			(
				await client.post('com.atproto.repo.createRecord', {
					input: { repo: 'did:plc:abc', collection: 'social.popfeed.feed.review', record: {} }
				})
			).ok
		).toBe(true);
		expect(onNotificationError).toHaveBeenCalledOnce();
	});
});
