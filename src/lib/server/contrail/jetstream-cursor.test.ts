import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ingestEvents,
	JetstreamLiveHistoryExpiredError,
	type ContrailConfig
} from '@atmo-dev/contrail';

// Use the same ws dependency as Contrail, with a loopback server. This exercises
// the installed patch, real WebSocket transport, decoder, and dedup pipeline.
const contrailRequire = createRequire(import.meta.resolve('@atmo-dev/contrail'));
const { WebSocketServer } = contrailRequire('ws');
let closeServer: (() => Promise<void>) | undefined;

const config: ContrailConfig = {
	namespace: 'watch.atmo',
	jetstreams: ['https://jetstream.example'],
	collections: { review: { collection: 'social.popfeed.feed.review' } }
};

function info(name: string) {
	return JSON.stringify({
		$type: 'message',
		payload: {
			$type: 'network.bsky.jetstream.subscribeEvents#info',
			name,
			message: 'test source advisory'
		}
	});
}

function identity(seq: number) {
	return JSON.stringify({
		$type: 'message',
		payload: {
			$type: 'network.bsky.jetstream.subscribeEvents#identity',
			did: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa',
			seq,
			time: '2026-10-26T21:23:19.167455Z',
			identity: { handle: 'example.test' }
		}
	});
}

async function frames(...messages: string[]) {
	const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
	closeServer = () =>
		new Promise<void>((resolve) => {
			for (const client of server.clients) client.terminate();
			server.close(() => resolve());
		});
	await new Promise<void>((resolve) => server.once('listening', resolve));
	config.jetstreams = [`http://127.0.0.1:${server.address().port}`];
	server.on('connection', (socket: { send: (message: string) => void }) => {
		for (const message of messages) socket.send(message);
	});
}

afterEach(async () => {
	await closeServer?.();
	closeServer = undefined;
	vi.unstubAllGlobals();
});

describe('patched Jetstream cursor handling', () => {
	it('rejects FutureCursor before lower live seqs can be silently deduplicated', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response('Upgrade required', { status: 426 }));
		vi.stubGlobal('fetch', fetch);
		await frames(info('FutureCursor'), identity(26_472_858_990));

		await expect(ingestEvents(config, 26_589_340_991, { maxDrainMs: 1000 })).rejects.toMatchObject({
			name: 'JetstreamFutureCursorError',
			message: expect.stringContaining('history continuity cannot be assumed')
		});
		// No futile post-failure preflight or automatic cursor reset.
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('still rejects expired history reported over the WebSocket', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 426 })));
		await frames(info('OutdatedCursor'), identity(43));
		await expect(ingestEvents(config, 42, { maxDrainMs: 1000 })).rejects.toBeInstanceOf(
			JetstreamLiveHistoryExpiredError
		);
	});

	it('still advances a valid seq cursor and preserves benign info handling', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 426 })));
		await frames(info('Welcome'), identity(43));
		const result = await ingestEvents(config, 42, { maxDrainMs: 1000 });
		expect(result.lastCursor).toBe(43);
		expect(result.stats.observedSourceItems).toBe(1);
	});

	it('still establishes a seq from a fresh timestamp-domain cursor', async () => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		await frames(identity(43));
		const result = await ingestEvents(config, 1_793_049_799_167_455, { maxDrainMs: 1000 });
		expect(result.lastCursor).toBe(43);
		expect(fetch).not.toHaveBeenCalled();
	});
});
