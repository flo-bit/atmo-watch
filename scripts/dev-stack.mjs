import { spawn } from 'node:child_process';
import { selectContrail } from './select-contrail.mjs';

const children = new Set();
let stopping = false;

function spawnPnpm(args) {
	const npmExecPath = process.env.npm_execpath;
	const command = npmExecPath ? process.execPath : 'pnpm';
	const commandArgs = npmExecPath ? [npmExecPath, ...args] : args;
	const child = spawn(command, commandArgs, {
		stdio: 'inherit',
		detached: process.platform !== 'win32'
	});
	children.add(child);
	child.once('exit', () => children.delete(child));
	return child;
}

function stopChild(child, signal = 'SIGTERM') {
	if (!child.pid || child.killed) return;
	try {
		if (process.platform === 'win32') child.kill(signal);
		else process.kill(-child.pid, signal);
	} catch {
		// The process may already have exited.
	}
}

function stopAll(signal = 'SIGTERM') {
	if (stopping) return;
	stopping = true;
	for (const child of children) stopChild(child, signal);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		const exitCode = signal === 'SIGINT' ? 130 : 143;
		stopAll(signal);
		process.exitCode = exitCode;
		setTimeout(() => process.exit(exitCode), 1_500).unref();
	});
}

// A first local run may backfill before Wrangler starts listening. Keep the
// standalone dev:local timeout short, but let the combined stack wait for it.
process.env.ATMO_LOCAL_API_WAIT_MS ??= String(15 * 60 * 1_000);

const api = spawnPnpm(['--dir', 'api', 'run', 'dev']);
const apiStartupFailure = new Promise((_, reject) => {
	api.once('exit', (code, signal) => {
		reject(new Error(`Local API exited with ${signal ?? `code ${code}`}`));
	});
});

try {
	await Promise.race([selectContrail('local'), apiStartupFailure]);

	const web = spawnPnpm(['exec', 'vite', 'dev']);
	const result = await Promise.race([
		new Promise((resolve) =>
			api.once('exit', (code, signal) => resolve({ service: 'API', code, signal }))
		),
		new Promise((resolve) =>
			web.once('exit', (code, signal) => resolve({ service: 'web app', code, signal }))
		)
	]);

	if (!stopping && result.code !== 0) {
		throw new Error(`${result.service} exited with ${result.signal ?? `code ${result.code}`}`);
	}
} catch (cause) {
	console.error(cause instanceof Error ? cause.message : cause);
	process.exitCode = 1;
} finally {
	stopAll();
}
