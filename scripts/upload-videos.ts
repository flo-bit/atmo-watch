#!/usr/bin/env node

import '@atcute/atproto';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { Client, parseRateLimitHeaders, retryFetchHandler } from '@atcute/client';
import { PasswordSession } from '@atcute/password-session';

const VIDEO_COLLECTION = 'watch.atmo.alpha.video';
const VIDEO_TYPES = new Set([
	'trailer',
	'teaser',
	'scene',
	'clip',
	'deleted_scene',
	'featurette',
	'behind_the_scenes',
	'interview',
	'blooper',
	'supercut',
	'recap',
	'review',
	'analysis',
	'reaction',
	'fan_edit',
	'other'
]);
const CREATIVE_WORK_TYPES = new Set(['movie', 'tv_show', 'tv_season', 'tv_episode']);
const DEFAULT_INPUT = 'data/video-submissions';

type SplitBy = 'title' | 'file' | 'record';

type VideoRecord = {
	$type: typeof VIDEO_COLLECTION;
	videoUrl: string;
	videoTitle?: string;
	channelName?: string;
	channelUrl?: string;
	thumbnailUrl?: string;
	youtubeId: string;
	videoType: string;
	creativeWorkType: 'movie' | 'tv_show' | 'tv_season' | 'tv_episode';
	identifiers: {
		tmdbId: string;
		tmdbTvSeriesId?: string;
		seasonNumber?: number;
		episodeNumber?: number;
	};
	title?: string;
	containsSpoilers?: boolean;
	createdAt: string;
};

type Submission = {
	sourceFile: string;
	record: VideoRecord;
	fingerprint: string;
};

type AccountSpec = {
	name: string;
	identifier: string;
	passwordEnv: string;
	service: string;
	intervalMs: number;
};

type AccountRuntime = {
	spec: AccountSpec;
	session: PasswordSession;
	client: Client;
};

type UploadState = {
	version: 1;
	uploads: Record<
		string,
		{
			youtubeId: string;
			uri: string;
			cid: string;
			account: string;
			uploadedAt: string;
		}
	>;
};

const cliArgs = process.argv.slice(2);
if (cliArgs[0] === '--') cliArgs.shift();
const { values, positionals } = parseArgs({
	args: cliArgs,
	options: {
		input: { type: 'string', short: 'i', multiple: true },
		accounts: { type: 'string' },
		account: { type: 'string' },
		'password-env': { type: 'string', default: 'ATPROTO_APP_PASSWORD' },
		service: { type: 'string' },
		'split-by': { type: 'string', default: 'title' },
		'interval-ms': { type: 'string', default: '2500' },
		'max-retry-delay-ms': { type: 'string', default: '900000' },
		state: { type: 'string' },
		force: { type: 'boolean', default: false },
		'dry-run': { type: 'boolean', default: false },
		help: { type: 'boolean', short: 'h', default: false }
	},
	allowPositionals: true
});

if (values.help) {
	printHelp();
	process.exit(0);
}

const splitBy = enumOption('--split-by', values['split-by'], ['title', 'file', 'record'] as const);
const defaultIntervalMs = integerOption('--interval-ms', values['interval-ms'], 0, 3_600_000);
const maxRetryDelayMs = integerOption(
	'--max-retry-delay-ms',
	values['max-retry-delay-ms'],
	1_000,
	86_400_000
);
const inputPaths = [...(values.input ?? []), ...positionals];
if (inputPaths.length === 0) inputPaths.push(DEFAULT_INPUT);
const statePath = path.resolve(values.state ?? path.join(DEFAULT_INPUT, '.upload-state.json'));
const files = await collectInputFiles(
	inputPaths.map((value) => path.resolve(value)),
	statePath
);
if (files.length === 0) fail('No JSON submission files were found.');

const submissions = await loadSubmissions(files);
const deduplicated = deduplicateSubmissions(submissions);
const state = await loadState(statePath);
const pendingFromState = values.force
	? deduplicated
	: deduplicated.filter((submission) => !state.uploads[submission.fingerprint]);
const skippedFromState = deduplicated.length - pendingFromState.length;
const accounts = await loadAccounts({
	configPath: values.accounts,
	identifier: values.account ?? process.env.ATPROTO_IDENTIFIER,
	passwordEnv: values['password-env'],
	service: values.service ?? process.env.ATPROTO_SERVICE ?? 'https://bsky.social',
	defaultIntervalMs,
	requirePasswords: !values['dry-run']
});

console.log(
	`Loaded ${submissions.length} submissions from ${files.length} files (${deduplicated.length} unique YouTube videos).`
);
if (skippedFromState > 0)
	console.log(`Skipping ${skippedFromState} already recorded in ${statePath}.`);
if (pendingFromState.length === 0) {
	console.log('Nothing to upload.');
	process.exit(0);
}

if (values['dry-run']) {
	printAssignments(assignSubmissions(pendingFromState, accounts, splitBy), splitBy);
	console.log('\nDry run only; no accounts were authenticated and no records were written.');
	process.exit(0);
}

console.log(`Authenticating ${accounts.length} AT Protocol account(s)…`);
const runtimes = await Promise.all(
	accounts.map((account) => createAccountRuntime(account, maxRetryDelayMs))
);

let pending = pendingFromState;
if (!values.force) {
	console.log('Checking participating repositories for existing video records…');
	const existingSets = await Promise.all(
		runtimes.map(async (runtime) => {
			const ids = await listExistingYoutubeIds(runtime);
			console.log(`  ${runtime.spec.name}: ${ids.size} existing video record(s)`);
			return ids;
		})
	);
	const existingIds = new Set(existingSets.flatMap((set) => [...set]));
	const before = pending.length;
	pending = pending.filter((submission) => !existingIds.has(submission.record.youtubeId));
	if (before !== pending.length) {
		console.log(
			`Skipping ${before - pending.length} video(s) already present in a participating repo.`
		);
	}
}
if (pending.length === 0) {
	console.log('Nothing to upload.');
	process.exit(0);
}

const assignments = assignSubmissions(pending, accounts, splitBy);
printAssignments(assignments, splitBy);

let stateWrite = Promise.resolve();
function saveSuccess(
	submission: Submission,
	result: { uri: string; cid: string },
	account: string
) {
	state.uploads[submission.fingerprint] = {
		youtubeId: submission.record.youtubeId,
		uri: result.uri,
		cid: result.cid,
		account,
		uploadedAt: new Date().toISOString()
	};
	stateWrite = stateWrite.then(() => writeJsonAtomic(statePath, state));
	return stateWrite;
}

const workerResults = await Promise.all(
	runtimes.map((runtime, index) =>
		uploadForAccount(runtime, assignments.get(index) ?? [], saveSuccess)
	)
);
await stateWrite;
const uploaded = workerResults.reduce((sum, result) => sum + result.uploaded, 0);
const failed = workerResults.flatMap((result) => result.failures);
console.log(`\nUploaded ${uploaded}/${pending.length} records. State: ${statePath}`);
if (failed.length > 0) {
	console.error(`${failed.length} upload(s) failed:`);
	for (const failure of failed) console.error(`  ${failure.youtubeId}: ${failure.message}`);
	process.exitCode = 1;
}

function printHelp() {
	console.log(`Upload reviewed video submissions to one or more AT Protocol accounts.

Usage:
  pnpm videos:upload -- [submission-file-or-directory ...] [options]
  pnpm videos:upload -- --input data/video-submissions --account bot.example
  pnpm videos:upload -- --input data/video-submissions --accounts scripts/video-accounts.example.json

Options:
  -i, --input <path>          JSON file or directory (repeatable; default: ${DEFAULT_INPUT})
  --accounts <file>           Multi-account JSON configuration
  --account <handle|did>      Single account (or set ATPROTO_IDENTIFIER)
  --password-env <name>       Single-account app-password env var (default: ATPROTO_APP_PASSWORD)
  --service <url>             Single-account login service (default: ATPROTO_SERVICE or bsky.social)
  --split-by <mode>           title|file|record (default: title)
                              title keeps every movie/show on one account
  --interval-ms <n>           Minimum delay between writes per account (default: 2500)
  --max-retry-delay-ms <n>    Longest wait accepted from a 429 response (default: 900000)
  --state <file>              Resume checkpoint (default: ${DEFAULT_INPUT}/.upload-state.json)
  --force                     Ignore checkpoint and existing-record checks
  --dry-run                   Show partitioning without login or writes
  -h, --help                  Show this help

Use app passwords, not primary account passwords. With --accounts, every entry names its
password via passwordEnv so secrets stay in the environment rather than the JSON file.`);
}

function fail(message: string): never {
	console.error(`Error: ${message}`);
	process.exit(1);
}

function integerOption(name: string, value: string | undefined, minimum: number, maximum: number) {
	const number = Number(value);
	if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
		fail(`${name} must be an integer between ${minimum} and ${maximum}.`);
	}
	return number;
}

function enumOption<const T extends readonly string[]>(
	name: string,
	value: string | undefined,
	allowed: T
): T[number] {
	if (!value || !allowed.includes(value)) fail(`${name} must be one of: ${allowed.join(', ')}.`);
	return value as T[number];
}

async function collectInputFiles(inputs: string[], excludedPath: string) {
	const found = new Set<string>();
	async function visit(entryPath: string) {
		let metadata;
		try {
			metadata = await stat(entryPath);
		} catch (cause) {
			throw new Error(`Cannot read input ${entryPath}: ${errorMessage(cause)}`, { cause });
		}
		if (metadata.isDirectory()) {
			for (const entry of await readdir(entryPath, { withFileTypes: true })) {
				if (entry.name.startsWith('.')) continue;
				await visit(path.join(entryPath, entry.name));
			}
			return;
		}
		if (
			metadata.isFile() &&
			path.extname(entryPath).toLowerCase() === '.json' &&
			path.resolve(entryPath) !== excludedPath
		) {
			found.add(path.resolve(entryPath));
		}
	}
	for (const input of inputs) await visit(input);
	return [...found].sort();
}

async function loadSubmissions(files: string[]) {
	const submissions: Submission[] = [];
	for (const filename of files) {
		let data: unknown;
		try {
			data = JSON.parse(await readFile(filename, 'utf8'));
		} catch (cause) {
			throw new Error(`Could not parse ${filename}: ${errorMessage(cause)}`, { cause });
		}
		let items: unknown[];
		if (Array.isArray(data)) items = data;
		else if (isObject(data) && Array.isArray(data.videos)) items = data.videos;
		else throw new Error(`${filename} must contain a videos array (or be an array).`);
		for (const [index, item] of items.entries()) {
			const rawRecord = isObject(item) && 'record' in item ? item.record : item;
			const record = validateRecord(rawRecord, `${filename} videos[${index}]`);
			submissions.push({
				sourceFile: filename,
				record,
				fingerprint: recordFingerprint(record)
			});
		}
	}
	return submissions;
}

function validateRecord(value: unknown, location: string): VideoRecord {
	if (!isObject(value)) throw new Error(`${location} is not a record object.`);
	if (value.$type !== VIDEO_COLLECTION) throw new Error(`${location} has the wrong $type.`);
	const youtubeId = requiredString(value.youtubeId, `${location}.youtubeId`, 64);
	if (!/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) throw new Error(`${location}.youtubeId is invalid.`);
	const videoUrl = requiredString(value.videoUrl, `${location}.videoUrl`, 2048);
	const expectedUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
	if (videoUrl !== expectedUrl) {
		throw new Error(`${location}.videoUrl must be the canonical URL ${expectedUrl}.`);
	}
	const videoType = requiredString(value.videoType, `${location}.videoType`, 100);
	if (!VIDEO_TYPES.has(videoType)) throw new Error(`${location}.videoType is not supported.`);
	const creativeWorkType = requiredString(
		value.creativeWorkType,
		`${location}.creativeWorkType`,
		100
	);
	if (!CREATIVE_WORK_TYPES.has(creativeWorkType)) {
		throw new Error(`${location}.creativeWorkType is not supported.`);
	}
	if (!isObject(value.identifiers)) throw new Error(`${location}.identifiers is required.`);
	const identifiers = {
		tmdbId: requiredString(value.identifiers.tmdbId, `${location}.identifiers.tmdbId`, 100),
		...(optionalString(
			value.identifiers.tmdbTvSeriesId,
			`${location}.identifiers.tmdbTvSeriesId`,
			100
		)
			? {
					tmdbTvSeriesId: optionalString(
						value.identifiers.tmdbTvSeriesId,
						`${location}.identifiers.tmdbTvSeriesId`,
						100
					)!
				}
			: {}),
		...(optionalInteger(value.identifiers.seasonNumber, `${location}.identifiers.seasonNumber`) !==
		undefined
			? {
					seasonNumber: optionalInteger(
						value.identifiers.seasonNumber,
						`${location}.identifiers.seasonNumber`
					)!
				}
			: {}),
		...(optionalInteger(
			value.identifiers.episodeNumber,
			`${location}.identifiers.episodeNumber`
		) !== undefined
			? {
					episodeNumber: optionalInteger(
						value.identifiers.episodeNumber,
						`${location}.identifiers.episodeNumber`
					)!
				}
			: {})
	};
	if (creativeWorkType === 'tv_season' || creativeWorkType === 'tv_episode') {
		if (!identifiers.tmdbTvSeriesId || identifiers.seasonNumber === undefined) {
			throw new Error(`${location} is missing its TV series or season identifier.`);
		}
	}
	if (creativeWorkType === 'tv_episode' && identifiers.episodeNumber === undefined) {
		throw new Error(`${location} is missing its episode identifier.`);
	}
	const createdAt = requiredString(value.createdAt, `${location}.createdAt`, 100);
	if (Number.isNaN(Date.parse(createdAt))) throw new Error(`${location}.createdAt is invalid.`);
	return {
		$type: VIDEO_COLLECTION,
		videoUrl,
		...(optionalString(value.videoTitle, `${location}.videoTitle`, 500)
			? { videoTitle: optionalString(value.videoTitle, `${location}.videoTitle`, 500)! }
			: {}),
		...(optionalString(value.channelName, `${location}.channelName`, 500)
			? { channelName: optionalString(value.channelName, `${location}.channelName`, 500)! }
			: {}),
		...(optionalHttpsUrl(value.channelUrl, `${location}.channelUrl`)
			? { channelUrl: optionalHttpsUrl(value.channelUrl, `${location}.channelUrl`)! }
			: {}),
		...(optionalHttpsUrl(value.thumbnailUrl, `${location}.thumbnailUrl`)
			? { thumbnailUrl: optionalHttpsUrl(value.thumbnailUrl, `${location}.thumbnailUrl`)! }
			: {}),
		youtubeId,
		videoType,
		creativeWorkType: creativeWorkType as VideoRecord['creativeWorkType'],
		identifiers,
		...(optionalString(value.title, `${location}.title`, 1000)
			? { title: optionalString(value.title, `${location}.title`, 1000)! }
			: {}),
		...(optionalBoolean(value.containsSpoilers, `${location}.containsSpoilers`) !== undefined
			? {
					containsSpoilers: optionalBoolean(value.containsSpoilers, `${location}.containsSpoilers`)!
				}
			: {}),
		createdAt
	};
}

function requiredString(value: unknown, location: string, maximum: number) {
	if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
		throw new Error(`${location} must be a non-empty string no longer than ${maximum}.`);
	}
	return value;
}

function optionalString(value: unknown, location: string, maximum: number) {
	if (value === undefined) return undefined;
	if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
		throw new Error(`${location} must be a non-empty string no longer than ${maximum}.`);
	}
	return value;
}

function optionalHttpsUrl(value: unknown, location: string) {
	const string = optionalString(value, location, 2048);
	if (!string) return undefined;
	try {
		if (new URL(string).protocol !== 'https:') throw new Error();
		return string;
	} catch {
		throw new Error(`${location} must be an HTTPS URL.`);
	}
}

function optionalInteger(value: unknown, location: string) {
	if (value === undefined) return undefined;
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new Error(`${location} must be a non-negative integer.`);
	}
	return value as number;
}

function optionalBoolean(value: unknown, location: string) {
	if (value === undefined) return undefined;
	if (typeof value !== 'boolean') throw new Error(`${location} must be a boolean.`);
	return value;
}

function deduplicateSubmissions(submissions: Submission[]) {
	const seen = new Set<string>();
	return submissions.filter((submission) => {
		if (seen.has(submission.record.youtubeId)) {
			console.warn(
				`Ignoring duplicate YouTube ID ${submission.record.youtubeId} in ${submission.sourceFile}.`
			);
			return false;
		}
		seen.add(submission.record.youtubeId);
		return true;
	});
}

function recordFingerprint(record: VideoRecord) {
	return createHash('sha256')
		.update(
			`${record.youtubeId}\0${record.creativeWorkType}\0${JSON.stringify(record.identifiers)}`
		)
		.digest('hex');
}

async function loadState(filename: string): Promise<UploadState> {
	try {
		const value: unknown = JSON.parse(await readFile(filename, 'utf8'));
		if (!isObject(value) || value.version !== 1 || !isObject(value.uploads)) {
			throw new Error('unsupported state format');
		}
		return value as UploadState;
	} catch (cause) {
		if (isNodeError(cause) && cause.code === 'ENOENT') return { version: 1, uploads: {} };
		throw new Error(`Could not load state ${filename}: ${errorMessage(cause)}`, { cause });
	}
}

async function loadAccounts(options: {
	configPath: string | undefined;
	identifier: string | undefined;
	passwordEnv: string;
	service: string;
	defaultIntervalMs: number;
	requirePasswords: boolean;
}) {
	let accounts: AccountSpec[];
	if (options.configPath) {
		let value: unknown;
		try {
			value = JSON.parse(await readFile(path.resolve(options.configPath), 'utf8'));
		} catch (cause) {
			throw new Error(`Could not read account config: ${errorMessage(cause)}`, { cause });
		}
		if (!isObject(value) || !Array.isArray(value.accounts) || value.accounts.length === 0) {
			throw new Error('Account config must contain a non-empty accounts array.');
		}
		accounts = value.accounts.map((entry, index) => {
			if (!isObject(entry)) throw new Error(`accounts[${index}] must be an object.`);
			const identifier = requiredString(entry.identifier, `accounts[${index}].identifier`, 500);
			const passwordEnv = requiredString(entry.passwordEnv, `accounts[${index}].passwordEnv`, 200);
			const service =
				optionalString(entry.service, `accounts[${index}].service`, 2048) ?? 'https://bsky.social';
			validateServiceUrl(service, `accounts[${index}].service`);
			const intervalMs =
				entry.intervalMs === undefined
					? options.defaultIntervalMs
					: configInteger(entry.intervalMs, `accounts[${index}].intervalMs`, 0, 3_600_000);
			return {
				name: optionalString(entry.name, `accounts[${index}].name`, 500) ?? identifier,
				identifier,
				passwordEnv,
				service,
				intervalMs
			};
		});
	} else {
		if (!options.identifier) {
			throw new Error('Pass --account, set ATPROTO_IDENTIFIER, or pass --accounts.');
		}
		validateServiceUrl(options.service, '--service');
		accounts = [
			{
				name: options.identifier,
				identifier: options.identifier,
				passwordEnv: options.passwordEnv,
				service: options.service,
				intervalMs: options.defaultIntervalMs
			}
		];
	}
	const identifiers = new Set<string>();
	for (const account of accounts) {
		if (identifiers.has(account.identifier)) {
			throw new Error(`Account ${account.identifier} appears more than once.`);
		}
		identifiers.add(account.identifier);
		if (options.requirePasswords && !process.env[account.passwordEnv]) {
			throw new Error(
				`Environment variable ${account.passwordEnv} is not set for ${account.name}.`
			);
		}
	}
	return accounts;
}

function validateServiceUrl(value: string, location: string) {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
			throw new Error();
		}
	} catch {
		throw new Error(`${location} must be an HTTPS URL.`);
	}
}

function configInteger(value: unknown, location: string, minimum: number, maximum: number): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
		throw new Error(`${location} must be an integer between ${minimum} and ${maximum}.`);
	}
	return value as number;
}

function assignSubmissions(submissions: Submission[], accounts: AccountSpec[], splitBy: SplitBy) {
	const groups = new Map<string, Submission[]>();
	for (const submission of submissions) {
		const key = assignmentKey(submission, splitBy);
		const group = groups.get(key) ?? [];
		group.push(submission);
		groups.set(key, group);
	}
	const assignments = new Map<number, Submission[]>(accounts.map((_account, index) => [index, []]));
	const totals = accounts.map(() => 0);
	const orderedGroups = [...groups.entries()].sort(
		([leftKey, left], [rightKey, right]) =>
			right.length - left.length || leftKey.localeCompare(rightKey)
	);
	for (const [, group] of orderedGroups) {
		let target = 0;
		for (let index = 1; index < totals.length; index++) {
			if (totals[index] < totals[target]) target = index;
		}
		assignments.get(target)!.push(...group);
		totals[target] += group.length;
	}
	return assignments;
}

function assignmentKey(submission: Submission, splitBy: SplitBy) {
	if (splitBy === 'file') return submission.sourceFile;
	if (splitBy === 'record') return submission.fingerprint;
	const { creativeWorkType, identifiers } = submission.record;
	if (creativeWorkType === 'movie') return `movie:${identifiers.tmdbId}`;
	return `show:${identifiers.tmdbTvSeriesId ?? identifiers.tmdbId}`;
}

function printAssignments(assignments: Map<number, Submission[]>, splitBy: SplitBy) {
	console.log(`\nUpload partition (split by ${splitBy}):`);
	for (const [index, account] of accounts.entries()) {
		const assigned = assignments.get(index) ?? [];
		const groups = new Set(assigned.map((submission) => assignmentKey(submission, splitBy)));
		console.log(`  ${account.name}: ${assigned.length} videos across ${groups.size} group(s)`);
	}
}

async function createAccountRuntime(
	spec: AccountSpec,
	maxRetryDelayMs: number
): Promise<AccountRuntime> {
	const password = process.env[spec.passwordEnv];
	if (!password) throw new Error(`Environment variable ${spec.passwordEnv} is missing.`);
	const session = await PasswordSession.login({
		service: spec.service,
		identifier: spec.identifier,
		password
	});
	const handler = retryFetchHandler({
		handler: session,
		maxRetries: 8,
		maxDelay: maxRetryDelayMs,
		fallbackDelay: 5_000,
		shouldRetry: (response) => response.status === 429,
		onRetry: (response, attempt, delay) => {
			console.warn(
				`  ${spec.name}: rate limited (${response.status}); retry ${attempt + 1} in ${formatDuration(delay)}.`
			);
		}
	});
	console.log(`  ${spec.name}: authenticated as ${session.did}`);
	return { spec, session, client: new Client({ handler }) };
}

async function listExistingYoutubeIds(runtime: AccountRuntime) {
	const ids = new Set<string>();
	let cursor: string | undefined;
	do {
		const response = await runtime.client.get('com.atproto.repo.listRecords', {
			params: {
				repo: runtime.session.did,
				collection: VIDEO_COLLECTION,
				limit: 100,
				...(cursor ? { cursor } : {})
			}
		});
		if (!response.ok) {
			throw new Error(
				`${runtime.spec.name}: could not list existing records (${response.status}): ${responseMessage(response.data)}`
			);
		}
		for (const item of response.data.records) {
			if (isObject(item.value) && typeof item.value.youtubeId === 'string') {
				ids.add(item.value.youtubeId);
			}
		}
		cursor = response.data.cursor;
	} while (cursor);
	return ids;
}

async function uploadForAccount(
	runtime: AccountRuntime,
	submissions: Submission[],
	onSuccess: (
		submission: Submission,
		result: { uri: string; cid: string },
		account: string
	) => Promise<void>
) {
	let uploaded = 0;
	const failures: Array<{ youtubeId: string; message: string }> = [];
	for (const [index, submission] of submissions.entries()) {
		const startedAt = Date.now();
		try {
			const response = await runtime.client.post('com.atproto.repo.createRecord', {
				input: {
					repo: runtime.session.did,
					collection: VIDEO_COLLECTION,
					record: { ...submission.record, createdAt: new Date().toISOString() }
				}
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${responseMessage(response.data)}`);
			}
			uploaded++;
			console.log(
				`  ${runtime.spec.name} [${index + 1}/${submissions.length}] ${submission.record.youtubeId} → ${response.data.uri}`
			);
			await onSuccess(
				submission,
				{ uri: response.data.uri, cid: response.data.cid },
				runtime.spec.identifier
			);
			const rateLimit = parseRateLimitHeaders(response.headers);
			const delay = proactiveDelay(runtime.spec.intervalMs, rateLimit);
			if (index + 1 < submissions.length) await sleepRemaining(startedAt, delay);
		} catch (cause) {
			const message = errorMessage(cause);
			failures.push({ youtubeId: submission.record.youtubeId, message });
			console.error(`  ${runtime.spec.name}: ${submission.record.youtubeId} failed: ${message}`);
			if (index + 1 < submissions.length) {
				await sleepRemaining(startedAt, runtime.spec.intervalMs);
			}
		}
	}
	return { uploaded, failures };
}

function proactiveDelay(minimumDelay: number, rateLimit: ReturnType<typeof parseRateLimitHeaders>) {
	if (!rateLimit) return minimumDelay;
	const resetIn = Math.max(0, rateLimit.reset.getTime() - Date.now());
	if (rateLimit.remaining === 0) return Math.max(minimumDelay, resetIn + 1_000);
	const lowWaterMark = Math.max(5, Math.ceil(rateLimit.limit * 0.02));
	if (rateLimit.remaining <= lowWaterMark) {
		return Math.max(minimumDelay, Math.ceil(resetIn / rateLimit.remaining));
	}
	return minimumDelay;
}

async function sleepRemaining(startedAt: number, minimumElapsed: number) {
	const delay = minimumElapsed - (Date.now() - startedAt);
	if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

function formatDuration(milliseconds: number) {
	if (milliseconds < 1_000) return `${milliseconds}ms`;
	if (milliseconds < 60_000) return `${Math.ceil(milliseconds / 1_000)}s`;
	return `${Math.ceil(milliseconds / 60_000)}m`;
}

async function writeJsonAtomic(filename: string, value: unknown) {
	await mkdir(path.dirname(filename), { recursive: true });
	const temporary = `${filename}.${process.pid}.tmp`;
	await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
	await rename(temporary, filename);
}

function responseMessage(data: unknown) {
	if (isObject(data) && typeof data.message === 'string') return data.message;
	if (isObject(data) && typeof data.error === 'string') return data.error;
	return 'Unknown AT Protocol error';
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
	return value instanceof Error && 'code' in value;
}

function errorMessage(cause: unknown) {
	return cause instanceof Error ? cause.message : String(cause);
}
