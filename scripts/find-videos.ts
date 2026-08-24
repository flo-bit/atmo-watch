#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
import {
	createAgentSession,
	createExtensionRuntime,
	defineTool,
	ModelRuntime,
	resolveCliModel,
	SessionManager,
	SettingsManager,
	type ResourceLoader
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { Innertube, YTNodes } from 'youtubei.js';

const VIDEO_COLLECTION = 'watch.atmo.alpha.video';
const VIDEO_TYPES = [
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
] as const;
const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
const DEFAULT_OUTPUT_DIR = 'data/video-submissions';
const DEFAULT_AI_MODEL = 'openai-codex/gpt-5.6-luna';
const DISCOVERY_CHECKPOINT_VERSION = 1;
const DISCOVERY_PIPELINE_VERSION = 1;

type MediaKind = 'movie' | 'show';
type VideoType = (typeof VIDEO_TYPES)[number];
type ThinkingLevel = (typeof THINKING_LEVELS)[number];

type TmdbVideo = {
	id: string;
	key: string;
	name?: string;
	site: string;
	type?: string;
	official?: boolean;
};

type TmdbMovie = {
	id: number;
	title: string;
	original_title?: string;
	overview?: string;
	release_date?: string;
	genres?: Array<{ name: string }>;
	videos?: { results?: TmdbVideo[] };
	credits?: {
		cast?: Array<{ name: string; character?: string; order?: number }>;
		crew?: Array<{ name: string; job?: string; department?: string }>;
	};
	keywords?: { keywords?: Array<{ name: string }> };
};

type TmdbShow = {
	id: number;
	name: string;
	original_name?: string;
	overview?: string;
	first_air_date?: string;
	genres?: Array<{ name: string }>;
	created_by?: Array<{ name: string }>;
	seasons?: Array<{
		id: number;
		name: string;
		season_number: number;
		episode_count?: number;
		air_date?: string | null;
	}>;
	videos?: { results?: TmdbVideo[] };
	aggregate_credits?: {
		cast?: Array<{
			name: string;
			order?: number;
			roles?: Array<{ character?: string; episode_count?: number }>;
		}>;
	};
	keywords?: { results?: Array<{ name: string }> };
};

type TmdbSeason = {
	id: number;
	name: string;
	season_number: number;
	overview?: string;
	air_date?: string | null;
	episodes?: Array<{
		id: number;
		name: string;
		episode_number: number;
		season_number: number;
		overview?: string;
		air_date?: string | null;
	}>;
	videos?: { results?: TmdbVideo[] };
};

type EpisodeContext = {
	tmdbId: number;
	seasonNumber: number;
	episodeNumber: number;
	name: string;
	overview: string;
	airDate: string | null;
};

type SeasonContext = {
	tmdbId: number;
	seasonNumber: number;
	name: string;
	overview: string;
	airDate: string | null;
	episodes: EpisodeContext[];
	videos: TmdbVideo[];
};

type PersonContext = {
	name: string;
	contributions: string[];
};

type MediaContext = {
	kind: MediaKind;
	tmdbId: number;
	title: string;
	originalTitle: string;
	year: string | null;
	overview: string;
	genres: string[];
	keywords: string[];
	people: PersonContext[];
	seasonScopeRestricted: boolean;
	seasons: SeasonContext[];
	videos: TmdbVideo[];
};

type SearchPlanQuery = {
	query: string;
	intent: string;
};

type SearchPlanResult = {
	queries: SearchPlanQuery[];
	notes: string;
	model: string | null;
	thinking: ThinkingLevel;
};

type SearchCandidate = {
	youtubeId: string;
	searchTitle: string;
	searchChannel: string;
	publishedLabel: string | null;
	approximateViews: number;
	queries: Set<string>;
	tmdbVideo: TmdbVideo | null;
};

type SerializedSearchCandidate = Omit<SearchCandidate, 'queries'> & { queries: string[] };

type SearchProgress = {
	candidates: SerializedSearchCandidate[];
	orderedByQuery: Record<string, string[]>;
	completedQueries: string[];
};

type DetailedCandidate = {
	youtubeId: string;
	videoUrl: string;
	title: string;
	description: string;
	channelId: string | null;
	channelName: string;
	channelUrl: string | null;
	thumbnailUrl: string | null;
	viewCount: number;
	durationSeconds: number;
	maxHeight: number;
	publishedLabel: string | null;
	queries: string[];
	tmdbVideo: TmdbVideo | null;
};

type AiSelection = {
	youtubeId: string;
	videoType: VideoType;
	creativeWorkType: 'movie' | 'tv_show' | 'tv_season' | 'tv_episode';
	seasonNumber?: number;
	episodeNumber?: number;
	containsSpoilers: boolean;
	confidence: number;
	rationale: string;
};

const AI_REJECTION_REASONS = [
	'unrelated',
	'duplicate',
	'redundant',
	'misleading_or_fake',
	'poor_content_quality',
	'insufficient_target_evidence',
	'full_length_piracy',
	'limit_reached',
	'unclassified',
	'other'
] as const;

type AiRejection = {
	youtubeId: string;
	reason: (typeof AI_REJECTION_REASONS)[number];
	rationale: string;
};

type AiReviewResult = {
	selections: AiSelection[];
	rejections: AiRejection[];
	notes: string;
	model: string | null;
	thinking: ThinkingLevel;
};

type CheckpointDetail =
	{ status: 'ok'; value: DetailedCandidate } | { status: 'error'; message: string };

type DiscoveryCheckpoint = {
	version: typeof DISCOVERY_CHECKPOINT_VERSION;
	pipelineVersion: typeof DISCOVERY_PIPELINE_VERSION;
	configHash: string;
	updatedAt: string;
	searchPlan?: SearchPlanResult;
	searchProgress?: SearchProgress;
	searchCandidates?: SerializedSearchCandidate[];
	details?: Record<string, CheckpointDetail>;
	review?: AiReviewResult;
};

type VideoRecord = {
	$type: typeof VIDEO_COLLECTION;
	videoUrl: string;
	videoTitle?: string;
	channelName?: string;
	channelUrl?: string;
	thumbnailUrl?: string;
	youtubeId: string;
	videoType: VideoType;
	creativeWorkType: 'movie' | 'tv_show' | 'tv_season' | 'tv_episode';
	identifiers: {
		tmdbId: string;
		tmdbTvSeriesId?: string;
		seasonNumber?: number;
		episodeNumber?: number;
	};
	title: string;
	containsSpoilers: boolean;
	createdAt: string;
};

const cliArgs = process.argv.slice(2);
if (cliArgs[0] === '--') cliArgs.shift();
const { values } = parseArgs({
	args: cliArgs,
	options: {
		movie: { type: 'string', multiple: true },
		show: { type: 'string', multiple: true },
		limit: { type: 'string', default: '25' },
		'candidate-limit': { type: 'string' },
		'query-limit': { type: 'string', default: '50' },
		'min-views': { type: 'string', default: '2500' },
		'min-height': { type: 'string', default: '720' },
		'min-duration': { type: 'string', default: '20' },
		seasons: { type: 'string' },
		output: { type: 'string', default: DEFAULT_OUTPUT_DIR },
		model: { type: 'string' },
		thinking: { type: 'string', default: 'high' },
		verbose: { type: 'boolean', default: false },
		fresh: { type: 'boolean', default: false },
		help: { type: 'boolean', short: 'h', default: false }
	},
	allowPositionals: false
});

if (values.help) {
	printHelp();
	process.exit(0);
}

const targets = [
	...(values.movie ?? []).map((value) => ({ kind: 'movie' as const, value })),
	...(values.show ?? []).map((value) => ({ kind: 'show' as const, value }))
];
if (targets.length === 0) fail('Pass at least one --movie or --show (a TMDB ID or title).');

const limit = integerOption('--limit', values.limit, 1, 200);
const queryLimit = integerOption('--query-limit', values['query-limit'], 1, 200);
const candidateLimit = integerOption(
	'--candidate-limit',
	values['candidate-limit'] ?? String(Math.min(500, Math.max(100, limit * 4, queryLimit * 4))),
	limit,
	500
);
const minViews = integerOption('--min-views', values['min-views'], 0, 10_000_000_000);
const minHeight = integerOption('--min-height', values['min-height'], 0, 4320);
const minDuration = integerOption('--min-duration', values['min-duration'], 0, 86_400);
const thinking = enumOption('--thinking', values.thinking, THINKING_LEVELS);
const selectedSeasonNumbers = values.seasons ? parseNumberRanges(values.seasons) : null;
const outputDir = path.resolve(values.output);
const verbose = values.verbose;

const tmdbAuth = getTmdbAuth();
const youtube = await Innertube.create({ lang: 'en', location: 'US' });
const modelRuntime = await ModelRuntime.create();
const modelSelection = resolveCliModel({
	cliModel: values.model ?? DEFAULT_AI_MODEL,
	cliThinking: thinking,
	modelRuntime
});
if (modelSelection.warning) console.warn(`Model warning: ${modelSelection.warning}`);
if (modelSelection.error) fail(modelSelection.error);

await mkdir(outputDir, { recursive: true });

for (const [targetIndex, target] of targets.entries()) {
	console.log(
		`\n[${targetIndex + 1}/${targets.length}] Resolving ${target.kind} ${JSON.stringify(target.value)}…`
	);
	const media = await resolveMedia(target.kind, target.value, selectedSeasonNumbers, tmdbAuth);
	console.log(
		`Resolved to ${media.title}${media.year ? ` (${media.year})` : ''} — TMDB ${media.tmdbId}`
	);

	const checkpointPath = path.join(
		outputDir,
		'.work',
		`${media.kind}-${media.tmdbId}-${slugify(media.title)}.json`
	);
	const configHash = discoveryConfigHash({
		pipelineVersion: DISCOVERY_PIPELINE_VERSION,
		media: {
			kind: media.kind,
			tmdbId: media.tmdbId,
			seasons: media.seasons.map((season) => season.seasonNumber)
		},
		limit,
		queryLimit,
		candidateLimit,
		minViews,
		minHeight,
		minDuration,
		model: modelSelection.model
			? `${modelSelection.model.provider}/${modelSelection.model.id}`
			: null,
		thinking: modelSelection.thinkingLevel ?? thinking
	});
	const checkpoint = await loadDiscoveryCheckpoint(checkpointPath, configHash, values.fresh);
	const saveCheckpoint = () => saveDiscoveryCheckpoint(checkpointPath, checkpoint);

	let searchPlan = checkpoint.searchPlan;
	if (searchPlan) {
		console.log(
			`Resuming saved AI search plan from ${path.relative(process.cwd(), checkpointPath)}.`
		);
	} else {
		console.log(`Asking pi to design ${queryLimit} title-specific YouTube searches…`);
		searchPlan = await planSearchesWithPi({
			media,
			limit: queryLimit,
			modelRuntime,
			model: modelSelection.model,
			thinking: modelSelection.thinkingLevel ?? thinking,
			verbose
		});
		checkpoint.searchPlan = searchPlan;
		await saveCheckpoint();
	}
	console.log(`AI search plan (${searchPlan.model ?? 'default model'}:${searchPlan.thinking}):`);
	for (const [index, item] of searchPlan.queries.entries()) {
		console.log(`  ${index + 1}. ${item.query} — ${item.intent}`);
	}
	const queries = searchPlan.queries.map((item) => item.query);

	let searchCandidates: SearchCandidate[];
	if (checkpoint.searchCandidates) {
		searchCandidates = checkpoint.searchCandidates.map(deserializeSearchCandidate);
		console.log(`Resuming ${searchCandidates.length} saved YouTube candidates.`);
	} else {
		const completedSearches = checkpoint.searchProgress?.completedQueries.length ?? 0;
		console.log(
			completedSearches > 0
				? `Resuming YouTube search at ${completedSearches}/${queries.length} completed queries…`
				: `Searching YouTube with ${queries.length} planned queries…`
		);
		const searchResult = await searchYouTube(
			youtube,
			media,
			queries,
			candidateLimit,
			checkpoint.searchProgress,
			async (progress) => {
				checkpoint.searchProgress = progress;
				await saveCheckpoint();
			}
		);
		searchCandidates = searchResult.candidates;
		checkpoint.searchProgress = searchResult.progress;
		checkpoint.searchCandidates = searchCandidates.map(serializeSearchCandidate);
		await saveCheckpoint();
	}
	console.log(`Inspecting ${searchCandidates.length} unique candidates…`);

	checkpoint.details ??= {};
	const savedDetailCount = searchCandidates.filter(
		(candidate) => checkpoint.details?.[candidate.youtubeId]
	).length;
	if (savedDetailCount > 0) {
		console.log(`Resuming ${savedDetailCount}/${searchCandidates.length} saved metadata checks.`);
	}
	const missingDetails = searchCandidates.filter(
		(candidate) => !checkpoint.details?.[candidate.youtubeId]
	);
	for (let offset = 0; offset < missingDetails.length; offset += 12) {
		const chunk = missingDetails.slice(offset, offset + 12);
		const results = await mapConcurrent(chunk, 4, (candidate) =>
			inspectCandidate(youtube, candidate)
		);
		for (const [index, result] of results.entries()) {
			const candidate = chunk[index];
			checkpoint.details[candidate.youtubeId] =
				result instanceof Error
					? { status: 'error', message: result.message }
					: { status: 'ok', value: result };
		}
		await saveCheckpoint();
		console.log(
			`  metadata ${Math.min(savedDetailCount + offset + chunk.length, searchCandidates.length)}/${searchCandidates.length}`
		);
	}
	const details = searchCandidates.map((candidate) => {
		const saved = checkpoint.details?.[candidate.youtubeId];
		if (!saved) return new Error(`${candidate.youtubeId}: metadata was not checked`);
		return saved.status === 'ok' ? saved.value : new Error(saved.message);
	});
	const rejectedBeforeAi: Record<string, number> = {};
	const rejectedBeforeReview: Array<Record<string, unknown>> = [];
	const eligible = details.flatMap((candidate, index) => {
		if (candidate instanceof Error) {
			increment(rejectedBeforeAi, 'metadata_unavailable');
			rejectedBeforeReview.push({
				youtubeId: searchCandidates[index]?.youtubeId ?? null,
				reason: 'metadata_unavailable',
				detail: candidate.message
			});
			if (verbose) console.warn(candidate.message);
			return [];
		}
		const rejection = mechanicalRejection(candidate, { minViews, minHeight, minDuration });
		if (rejection) {
			increment(rejectedBeforeAi, rejection);
			rejectedBeforeReview.push({
				youtubeId: candidate.youtubeId,
				title: candidate.title,
				reason: rejection,
				viewCount: candidate.viewCount,
				maxHeight: candidate.maxHeight,
				durationSeconds: candidate.durationSeconds
			});
			return [];
		}
		return [candidate];
	});

	let review = checkpoint.review;
	if (review) {
		console.log(`Resuming saved AI review with ${review.selections.length} selections.`);
	} else {
		console.log(
			`${eligible.length} candidates passed view, duration, availability, and ${minHeight}p filters; asking pi to curate up to ${limit}…`
		);
		review = await reviewWithPi({
			media,
			candidates: eligible,
			limit,
			modelRuntime,
			model: modelSelection.model,
			thinking: modelSelection.thinkingLevel ?? thinking,
			youtube,
			verbose
		});
		checkpoint.review = review;
		await saveCheckpoint();
	}
	const generatedAt = new Date().toISOString();
	const accepted = buildAcceptedVideos(media, eligible, review.selections, generatedAt, limit);
	const eligibleById = new Map(eligible.map((candidate) => [candidate.youtubeId, candidate]));
	const reviewRejections = review.rejections.map((rejection) => {
		const candidate = eligibleById.get(rejection.youtubeId);
		return {
			...rejection,
			...(candidate
				? {
						title: candidate.title,
						channelName: candidate.channelName,
						viewCount: candidate.viewCount,
						maxHeight: candidate.maxHeight,
						durationSeconds: candidate.durationSeconds
					}
				: {})
		};
	});

	const document = {
		schemaVersion: 1,
		generatedAt,
		collection: VIDEO_COLLECTION,
		media: {
			kind: media.kind,
			tmdbId: media.tmdbId,
			title: media.title,
			year: media.year
		},
		discovery: {
			queries,
			searchPlan: {
				model: searchPlan.model,
				thinking: searchPlan.thinking,
				notes: searchPlan.notes,
				queries: searchPlan.queries
			},
			candidateCount: searchCandidates.length,
			eligibleCandidateCount: eligible.length,
			filters: {
				minViews,
				minHeight,
				minDuration,
				rejectedBeforeAi,
				rejections: rejectedBeforeReview
			},
			review: {
				model: review.model,
				thinking: review.thinking,
				notes: review.notes,
				selectedCount: accepted.length,
				rejectedCount: reviewRejections.length,
				rejections: reviewRejections
			}
		},
		videos: accepted
	};
	const filename = `${media.kind}-${media.tmdbId}-${slugify(media.title)}.json`;
	const outputPath = path.join(outputDir, filename);
	await writeJsonAtomic(outputPath, document);
	console.log(
		`Wrote ${accepted.length} reviewed videos to ${path.relative(process.cwd(), outputPath)}`
	);
}

function discoveryConfigHash(value: unknown) {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function createDiscoveryCheckpoint(configHash: string): DiscoveryCheckpoint {
	return {
		version: DISCOVERY_CHECKPOINT_VERSION,
		pipelineVersion: DISCOVERY_PIPELINE_VERSION,
		configHash,
		updatedAt: new Date().toISOString()
	};
}

async function loadDiscoveryCheckpoint(
	filename: string,
	configHash: string,
	fresh: boolean
): Promise<DiscoveryCheckpoint> {
	if (fresh) {
		await rm(filename, { force: true });
		console.log(
			`Starting fresh; ignored any checkpoint at ${path.relative(process.cwd(), filename)}.`
		);
		return createDiscoveryCheckpoint(configHash);
	}
	try {
		const value: unknown = JSON.parse(await readFile(filename, 'utf8'));
		if (
			!isObject(value) ||
			value.version !== DISCOVERY_CHECKPOINT_VERSION ||
			value.pipelineVersion !== DISCOVERY_PIPELINE_VERSION ||
			typeof value.configHash !== 'string'
		) {
			console.warn(`Ignoring an incompatible discovery checkpoint at ${filename}.`);
			return createDiscoveryCheckpoint(configHash);
		}
		if (value.configHash !== configHash) {
			console.warn(
				`Discovery options changed; starting fresh instead of resuming ${path.relative(process.cwd(), filename)}.`
			);
			return createDiscoveryCheckpoint(configHash);
		}
		return value as DiscoveryCheckpoint;
	} catch (cause) {
		if (isNodeError(cause) && cause.code === 'ENOENT') {
			return createDiscoveryCheckpoint(configHash);
		}
		throw new Error(`Could not load discovery checkpoint ${filename}: ${errorMessage(cause)}`, {
			cause
		});
	}
}

async function saveDiscoveryCheckpoint(filename: string, checkpoint: DiscoveryCheckpoint) {
	checkpoint.updatedAt = new Date().toISOString();
	await writeJsonAtomic(filename, checkpoint);
}

function serializeSearchCandidate(candidate: SearchCandidate): SerializedSearchCandidate {
	return { ...candidate, queries: [...candidate.queries] };
}

function deserializeSearchCandidate(candidate: SerializedSearchCandidate): SearchCandidate {
	return { ...candidate, queries: new Set(candidate.queries) };
}

function printHelp() {
	console.log(`Find and AI-review YouTube videos for movies and TV shows.

Usage:
  pnpm videos:find -- --movie <TMDB-ID-or-title> [options]
  pnpm videos:find -- --show <TMDB-ID-or-title> [options]

Targets can be repeated; one JSON file is written per target:
  pnpm videos:find -- --movie 550 --movie "The Matrix" --show 1396 --limit 30

Options:
  --movie <id|title>       Movie to process (repeatable)
  --show <id|title>        TV show to process (repeatable)
  --limit <n>              Maximum accepted videos per target (default: 25)
  --candidate-limit <n>    Maximum candidates inspected/reviewed (dynamic default; max: 500)
  --query-limit <n>        AI-planned YouTube searches (default: 50; max: 200)
  --min-views <n>          Hard minimum view count (default: 2500)
  --min-height <n>         Hard minimum available resolution (default: 720)
  --min-duration <sec>     Hard minimum duration (default: 20)
  --seasons <list>         TV seasons to search, e.g. 1,3-5 (specials are excluded by default)
  --output <dir>           Output directory (default: ${DEFAULT_OUTPUT_DIR})
  --model <model>          Pi model (default: ${DEFAULT_AI_MODEL})
  --thinking <level>       off|minimal|low|medium|high|xhigh|max (default: high)
  --verbose                Stream the planning and review agents' text
  --fresh                  Ignore saved discovery work and start this target again
  -h, --help               Show this help

Environment:
  TMDB_ACCESS_TOKEN (recommended) or TMDB_API_KEY
  Pi uses the model credentials already configured in ~/.pi/agent/auth.json.`);
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

function uniquePeople(people: PersonContext[]) {
	const byName = new Map<string, PersonContext>();
	for (const person of people) {
		const current = byName.get(person.name);
		if (!current) {
			byName.set(person.name, {
				name: person.name,
				contributions: [...new Set(person.contributions)]
			});
			continue;
		}
		current.contributions = [...new Set([...current.contributions, ...person.contributions])];
	}
	return [...byName.values()];
}

function parseNumberRanges(value: string) {
	const numbers = new Set<number>();
	for (const part of value.split(',')) {
		const trimmed = part.trim();
		const match = /^(\d+)(?:-(\d+))?$/.exec(trimmed);
		if (!match) fail(`Invalid --seasons value ${JSON.stringify(trimmed)}.`);
		const start = Number(match[1]);
		const end = Number(match[2] ?? match[1]);
		if (end < start || end - start > 100)
			fail(`Invalid --seasons range ${JSON.stringify(trimmed)}.`);
		for (let number = start; number <= end; number++) numbers.add(number);
	}
	return numbers;
}

function getTmdbAuth() {
	const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim();
	const apiKey = process.env.TMDB_API_KEY?.trim();
	if (!accessToken && !apiKey) {
		fail('Set TMDB_ACCESS_TOKEN or TMDB_API_KEY before running video discovery.');
	}
	if (accessToken) return { bearer: accessToken, apiKey: null };
	if (apiKey?.startsWith('eyJ')) return { bearer: apiKey, apiKey: null };
	return { bearer: null, apiKey: apiKey ?? null };
}

async function tmdbFetch<T>(
	pathname: string,
	searchParams: Record<string, string>,
	auth: ReturnType<typeof getTmdbAuth>
): Promise<T> {
	const url = new URL(pathname, 'https://api.themoviedb.org/3/');
	for (const [key, value] of Object.entries(searchParams)) url.searchParams.set(key, value);
	if (auth.apiKey) url.searchParams.set('api_key', auth.apiKey);
	const response = await fetch(url, {
		headers: {
			accept: 'application/json',
			...(auth.bearer ? { authorization: `Bearer ${auth.bearer}` } : {})
		},
		signal: AbortSignal.timeout(20_000)
	});
	if (!response.ok) {
		throw new Error(`TMDB ${url.pathname} failed (${response.status}): ${await response.text()}`);
	}
	return (await response.json()) as T;
}

async function resolveMedia(
	kind: MediaKind,
	value: string,
	selectedSeasons: Set<number> | null,
	auth: ReturnType<typeof getTmdbAuth>
): Promise<MediaContext> {
	let tmdbId: number;
	if (/^\d+$/.test(value.trim())) {
		tmdbId = Number(value.trim());
	} else {
		const endpoint = kind === 'movie' ? 'search/movie' : 'search/tv';
		const result = await tmdbFetch<{
			results?: Array<{ id: number; title?: string; name?: string }>;
		}>(endpoint, { query: value, include_adult: 'false', language: 'en-US' }, auth);
		const first = result.results?.[0];
		if (!first) throw new Error(`TMDB did not find a ${kind} matching ${JSON.stringify(value)}.`);
		tmdbId = first.id;
	}

	if (kind === 'movie') {
		const movie = await tmdbFetch<TmdbMovie>(
			`movie/${tmdbId}`,
			{
				append_to_response: 'videos,credits,keywords',
				language: 'en-US'
			},
			auth
		);
		return {
			kind,
			tmdbId: movie.id,
			title: movie.title,
			originalTitle: movie.original_title || movie.title,
			year: movie.release_date?.slice(0, 4) || null,
			overview: movie.overview || '',
			genres: (movie.genres ?? []).map((genre) => genre.name),
			keywords: (movie.keywords?.keywords ?? []).map((keyword) => keyword.name),
			people: uniquePeople([
				...(movie.credits?.crew ?? [])
					.filter((person) => ['Director', 'Writer', 'Screenplay'].includes(person.job ?? ''))
					.map((person) => ({ name: person.name, contributions: [person.job ?? 'Crew'] })),
				...(movie.credits?.cast ?? [])
					.toSorted((left, right) => (left.order ?? 999) - (right.order ?? 999))
					.slice(0, 30)
					.map((person) => ({
						name: person.name,
						contributions: person.character ? [`Character: ${person.character}`] : ['Cast']
					}))
			]),
			seasonScopeRestricted: false,
			seasons: [],
			videos: movie.videos?.results ?? []
		};
	}

	const show = await tmdbFetch<TmdbShow>(
		`tv/${tmdbId}`,
		{
			append_to_response: 'videos,aggregate_credits,keywords',
			language: 'en-US'
		},
		auth
	);
	const seasonSummaries = (show.seasons ?? []).filter((season) =>
		selectedSeasons ? selectedSeasons.has(season.season_number) : season.season_number > 0
	);
	if (selectedSeasons) {
		const found = new Set(seasonSummaries.map((season) => season.season_number));
		const missing = [...selectedSeasons].filter((number) => !found.has(number));
		if (missing.length > 0) throw new Error(`TMDB show has no season(s): ${missing.join(', ')}.`);
	}
	const seasonResults = await mapConcurrent(seasonSummaries, 4, (season) =>
		tmdbFetch<TmdbSeason>(
			`tv/${show.id}/season/${season.season_number}`,
			{
				append_to_response: 'videos',
				language: 'en-US'
			},
			auth
		)
	);
	const seasons = seasonResults.map((season) => {
		if (season instanceof Error) throw season;
		return {
			tmdbId: season.id,
			seasonNumber: season.season_number,
			name: season.name,
			overview: season.overview || '',
			airDate: season.air_date || null,
			episodes: (season.episodes ?? []).map((episode) => ({
				tmdbId: episode.id,
				seasonNumber: episode.season_number,
				episodeNumber: episode.episode_number,
				name: episode.name,
				overview: episode.overview || '',
				airDate: episode.air_date || null
			})),
			videos: season.videos?.results ?? []
		};
	});
	return {
		kind,
		tmdbId: show.id,
		title: show.name,
		originalTitle: show.original_name || show.name,
		year: show.first_air_date?.slice(0, 4) || null,
		overview: show.overview || '',
		genres: (show.genres ?? []).map((genre) => genre.name),
		keywords: (show.keywords?.results ?? []).map((keyword) => keyword.name),
		people: uniquePeople([
			...(show.created_by ?? []).map((person) => ({
				name: person.name,
				contributions: ['Creator']
			})),
			...(show.aggregate_credits?.cast ?? [])
				.toSorted((left, right) => (left.order ?? 999) - (right.order ?? 999))
				.slice(0, 40)
				.map((person) => ({
					name: person.name,
					contributions: (person.roles ?? [])
						.toSorted((left, right) => (right.episode_count ?? 0) - (left.episode_count ?? 0))
						.flatMap((role) => (role.character ? [`Character: ${role.character}`] : []))
						.filter((role, index, roles) => roles.indexOf(role) === index)
						.slice(0, 4)
				}))
		]),
		seasonScopeRestricted: selectedSeasons !== null,
		seasons,
		videos: show.videos?.results ?? []
	};
}

async function planSearchesWithPi(options: {
	media: MediaContext;
	limit: number;
	modelRuntime: ModelRuntime;
	model: ReturnType<typeof resolveCliModel>['model'];
	thinking: ThinkingLevel;
	verbose: boolean;
}) {
	let finalPlan: { queries: SearchPlanQuery[]; notes: string } | null = null;
	const submitPlan = defineTool({
		name: 'submit_search_plan',
		label: 'Submit search plan',
		description: 'Submit the final set of distinct YouTube searches and end planning.',
		promptSnippet: 'Submit the final machine-readable YouTube search plan',
		promptGuidelines: ['Call submit_search_plan exactly once as your final action.'],
		parameters: Type.Object({
			queries: Type.Array(
				Type.Object({
					query: Type.String({ minLength: 3, maxLength: 240 }),
					intent: Type.String({ minLength: 3, maxLength: 240 })
				}),
				{ minItems: options.limit, maxItems: options.limit }
			),
			notes: Type.String({ maxLength: 2000 })
		}),
		async execute(_toolCallId, params) {
			finalPlan = { queries: params.queries, notes: params.notes };
			return {
				content: [
					{
						type: 'text' as const,
						text: `Saved ${params.queries.length} planned YouTube searches.`
					}
				],
				details: { queryCount: params.queries.length },
				terminate: true
			};
		}
	});
	const systemPrompt = `You are the search strategist for a curated movie and TV video library.
Before any YouTube search happens, design a broad but precise search plan for the supplied title. Return exactly the requested number of distinct, executable YouTube query strings.

Do not merely emit generic searches such as "show clips". Use the supplied cast, characters, creators, keywords, seasons, and episode titles to identify what fans would actually want to watch. For a show such as Game of Thrones, strong searches include queries like "Game of Thrones Arya Stark best scenes", "Game of Thrones Jon Snow best scenes", and "Game of Thrones season 1 recap". Apply the same title-specific reasoning to every movie or show.

Build a scene-heavy but varied plan across the most useful applicable areas:
- individual scenes and clips are the highest priority; for TV, devote at least half the query budget to episode scenes, iconic moments, character scenes, relationship scenes, and dialogue clips;
- when the budget allows, use several distinct scene searches per episode rather than one broad episode query;
- best scenes or compilations for several major characters, relationships, performers, or conflicts;
- official trailers, teasers, featurettes, deleted scenes, and promotional material;
- season recaps for TV seasons, with broad season coverage when the budget allows;
- cast, creator, or director interviews and behind-the-scenes material;
- bloopers and production material;
- reputable reviews, retrospectives, thematic analysis, and ending/character analysis.

Individual scenes must not be crowded out by interviews, recaps, or analysis. Every query must contain the movie/show title (and year when useful), be likely to produce relevant YouTube videos, have a clearly different intent, and avoid searches for pirated full movies or episodes. If seasonScopeRestricted is true, every query must stay within the supplied seasons: do not search later storylines, the series ending, or later character arcs. Prioritize breadth and title-specific concepts over tiny wording variations. Use only submit_search_plan as the final action.`;
	const resourceLoader: ResourceLoader = {
		getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
		getSkills: () => ({ skills: [], diagnostics: [] }),
		getPrompts: () => ({ prompts: [], diagnostics: [] }),
		getThemes: () => ({ themes: [], diagnostics: [] }),
		getAgentsFiles: () => ({ agentsFiles: [] }),
		getSystemPrompt: () => systemPrompt,
		getAppendSystemPrompt: () => [],
		extendResources: () => {},
		reload: async () => {}
	};
	const settingsManager = SettingsManager.inMemory({
		compaction: { enabled: false },
		retry: { enabled: true, maxRetries: 3 }
	});
	const { session } = await createAgentSession({
		cwd: process.cwd(),
		model: options.model,
		thinkingLevel: options.thinking,
		modelRuntime: options.modelRuntime,
		resourceLoader,
		tools: ['submit_search_plan'],
		customTools: [submitPlan],
		sessionManager: SessionManager.inMemory(process.cwd()),
		settingsManager
	});
	try {
		session.subscribe((event) => {
			if (
				options.verbose &&
				event.type === 'message_update' &&
				event.assistantMessageEvent.type === 'text_delta'
			) {
				process.stdout.write(event.assistantMessageEvent.delta);
			}
		});
		await session.prompt(buildSearchPlanningPrompt(options.media, options.limit));
		if (options.verbose) process.stdout.write('\n');
		if (!finalPlan) {
			throw new Error(
				session.agent.state.errorMessage || 'The pi planner did not call submit_search_plan.'
			);
		}
		const seen = new Set<string>();
		const queries = finalPlan.queries.flatMap((item) => {
			const query = item.query.trim().replace(/\s+/g, ' ');
			const key = query.toLowerCase();
			if (!query || seen.has(key)) return [];
			seen.add(key);
			return [{ query, intent: item.intent.trim() }];
		});
		if (queries.length !== options.limit) {
			throw new Error(
				`The pi planner returned ${queries.length} distinct searches; expected ${options.limit}.`
			);
		}
		return {
			queries,
			notes: finalPlan.notes,
			model: session.model ? `${session.model.provider}/${session.model.id}` : null,
			thinking: session.thinkingLevel
		};
	} finally {
		session.dispose();
	}
}

function buildSearchPlanningPrompt(media: MediaContext, queryCount: number) {
	const episodeCount = media.seasons.reduce((sum, season) => sum + season.episodes.length, 0);
	const includeEveryEpisode = episodeCount <= 200;
	return `Create exactly ${queryCount} distinct YouTube searches for this title. Make the plan specific enough to discover character-focused, season-focused, episode-focused, production, promotional, and critical videos—not just generic trailers and clips.

MEDIA_CONTEXT
${JSON.stringify({
	kind: media.kind,
	tmdbId: media.tmdbId,
	title: media.title,
	originalTitle: media.originalTitle,
	year: media.year,
	overview: truncate(media.overview, 1500),
	genres: media.genres,
	keywords: media.keywords.slice(0, 40),
	people: media.people,
	seasonScopeRestricted: media.seasonScopeRestricted,
	seasons: media.seasons.map((season) => ({
		seasonNumber: season.seasonNumber,
		name: season.name,
		overview: truncate(season.overview, 300),
		episodes: (includeEveryEpisode
			? season.episodes
			: [...season.episodes.slice(0, 5), ...season.episodes.slice(-5)]
		).map((episode) => ({ episodeNumber: episode.episodeNumber, name: episode.name }))
	}))
})}\n`;
}

async function searchYouTube(
	youtube: Innertube,
	media: MediaContext,
	queries: string[],
	maximum: number,
	resume: SearchProgress | undefined,
	onProgress: (progress: SearchProgress) => Promise<void>
) {
	const candidates = new Map<string, SearchCandidate>(
		(resume?.candidates ?? []).map((candidate) => [
			candidate.youtubeId,
			deserializeSearchCandidate(candidate)
		])
	);
	const orderedByQuery = { ...(resume?.orderedByQuery ?? {}) };
	const completedQueries = new Set(resume?.completedQueries ?? []);
	const tmdbVideos = [...media.videos, ...media.seasons.flatMap((season) => season.videos)].filter(
		(video) => video.site === 'YouTube' && /^[A-Za-z0-9_-]{11}$/.test(video.key)
	);
	for (const video of tmdbVideos) {
		const current = candidates.get(video.key);
		if (current) {
			current.queries.add(`TMDB ${video.type || 'video'}`);
			current.tmdbVideo = video;
			if (!current.searchTitle) current.searchTitle = video.name || '';
			continue;
		}
		candidates.set(video.key, {
			youtubeId: video.key,
			searchTitle: video.name || '',
			searchChannel: '',
			publishedLabel: null,
			approximateViews: 0,
			queries: new Set([`TMDB ${video.type || 'video'}`]),
			tmdbVideo: video
		});
	}

	const progress = (): SearchProgress => ({
		candidates: [...candidates.values()].map(serializeSearchCandidate),
		orderedByQuery,
		completedQueries: [...completedQueries]
	});
	let unsavedSearches = 0;
	for (const [index, query] of queries.entries()) {
		if (completedQueries.has(query)) continue;
		if (verbose) console.log(`  search ${index + 1}/${queries.length}: ${query}`);
		const ids: string[] = [];
		try {
			const search = await youtube.search(query, { type: 'video' });
			for (const node of search.results) {
				if (!node.is(YTNodes.Video) || node.is_live || node.is_upcoming) continue;
				ids.push(node.video_id);
				const current = candidates.get(node.video_id);
				if (current) {
					current.queries.add(query);
					if (!current.searchTitle) current.searchTitle = node.title.toString();
					if (!current.searchChannel) current.searchChannel = node.author.name;
					current.approximateViews = Math.max(
						current.approximateViews,
						parseViewCount(node.view_count?.toString())
					);
				} else {
					candidates.set(node.video_id, {
						youtubeId: node.video_id,
						searchTitle: node.title.toString(),
						searchChannel: node.author.name,
						publishedLabel: node.published?.toString() ?? null,
						approximateViews: parseViewCount(node.view_count?.toString()),
						queries: new Set([query]),
						tmdbVideo: null
					});
				}
			}
		} catch (cause) {
			console.warn(`  YouTube search failed for ${JSON.stringify(query)}: ${errorMessage(cause)}`);
		}
		orderedByQuery[query] = ids;
		completedQueries.add(query);
		unsavedSearches++;
		if (unsavedSearches >= 5) {
			await onProgress(progress());
			unsavedSearches = 0;
		}
	}
	await onProgress(progress());

	const selected: SearchCandidate[] = [];
	const selectedIds = new Set<string>();
	for (const video of tmdbVideos) {
		const candidate = candidates.get(video.key);
		if (candidate && !selectedIds.has(video.key)) {
			selected.push(candidate);
			selectedIds.add(video.key);
		}
	}
	const orderedResults = queries.map((query) => orderedByQuery[query] ?? []);
	for (let rank = 0; selected.length < maximum; rank++) {
		let foundAtRank = false;
		for (const ids of orderedResults) {
			const id = ids[rank];
			if (!id) continue;
			foundAtRank = true;
			if (selectedIds.has(id)) continue;
			const candidate = candidates.get(id);
			if (!candidate) continue;
			selected.push(candidate);
			selectedIds.add(id);
			if (selected.length >= maximum) break;
		}
		if (!foundAtRank) break;
	}
	return { candidates: selected.slice(0, maximum), progress: progress() };
}

async function inspectCandidate(
	youtube: Innertube,
	candidate: SearchCandidate
): Promise<DetailedCandidate | Error> {
	try {
		const info = await youtube.getBasicInfo(candidate.youtubeId);
		const basic = info.basic_info;
		if (info.playability_status?.status !== 'OK' || basic.is_private || basic.is_upcoming) {
			throw new Error(`${candidate.youtubeId}: video is not publicly playable`);
		}
		const formats = [
			...(info.streaming_data?.formats ?? []),
			...(info.streaming_data?.adaptive_formats ?? [])
		];
		const thumbnails = basic.thumbnail ?? [];
		const thumbnail = thumbnails.toSorted((a, b) => b.width * b.height - a.width * a.height)[0];
		const channelId = basic.channel?.id || basic.channel_id || null;
		return {
			youtubeId: candidate.youtubeId,
			videoUrl: `https://www.youtube.com/watch?v=${candidate.youtubeId}`,
			title: (basic.title || candidate.searchTitle).trim(),
			description: (basic.short_description || '').trim(),
			channelId,
			channelName: (basic.channel?.name || basic.author || candidate.searchChannel).trim(),
			channelUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : null,
			thumbnailUrl: thumbnail?.url || null,
			viewCount: basic.view_count ?? candidate.approximateViews,
			durationSeconds: basic.duration ?? 0,
			maxHeight: Math.max(0, ...formats.map((format) => format.height ?? 0)),
			publishedLabel: candidate.publishedLabel,
			queries: [...candidate.queries],
			tmdbVideo: candidate.tmdbVideo
		};
	} catch (cause) {
		return new Error(`${candidate.youtubeId}: ${errorMessage(cause)}`);
	}
}

function mechanicalRejection(
	candidate: DetailedCandidate,
	filters: { minViews: number; minHeight: number; minDuration: number }
) {
	if (!candidate.title) return 'missing_title';
	if (candidate.viewCount < filters.minViews) return 'low_views';
	if (candidate.maxHeight < filters.minHeight) return 'low_resolution';
	if (candidate.durationSeconds < filters.minDuration) return 'too_short';
	return null;
}

async function reviewWithPi(options: {
	media: MediaContext;
	candidates: DetailedCandidate[];
	limit: number;
	modelRuntime: ModelRuntime;
	model: ReturnType<typeof resolveCliModel>['model'];
	thinking: ThinkingLevel;
	youtube: Innertube;
	verbose: boolean;
}) {
	let finalReview: {
		selections: AiSelection[];
		rejections: AiRejection[];
		notes: string;
	} | null = null;
	let researchCalls = 0;
	const knownIds = new Set(options.candidates.map((candidate) => candidate.youtubeId));
	const selectionSchema = Type.Object({
		youtubeId: Type.String({ minLength: 11, maxLength: 11 }),
		videoType: Type.Union(VIDEO_TYPES.map((value) => Type.Literal(value))),
		creativeWorkType: Type.Union([
			Type.Literal('movie'),
			Type.Literal('tv_show'),
			Type.Literal('tv_season'),
			Type.Literal('tv_episode')
		]),
		seasonNumber: Type.Optional(Type.Integer({ minimum: 0 })),
		episodeNumber: Type.Optional(Type.Integer({ minimum: 0 })),
		containsSpoilers: Type.Boolean(),
		confidence: Type.Number({ minimum: 0, maximum: 1 }),
		rationale: Type.String({ minLength: 1, maxLength: 500 })
	});
	const rejectionSchema = Type.Object({
		youtubeId: Type.String({ minLength: 11, maxLength: 11 }),
		reason: Type.Union(AI_REJECTION_REASONS.map((value) => Type.Literal(value))),
		rationale: Type.String({ minLength: 1, maxLength: 500 })
	});
	const researchWeb = defineTool({
		name: 'research_web',
		label: 'Research web',
		description:
			'Search the public web for evidence about a candidate video, especially its exact TV season or episode.',
		parameters: Type.Object({
			query: Type.String({ minLength: 2, maxLength: 300 })
		}),
		async execute(_toolCallId, params) {
			researchCalls++;
			if (researchCalls > 10) {
				return {
					content: [{ type: 'text' as const, text: 'Research limit reached; finish the review.' }],
					details: {}
				};
			}
			try {
				const results = await searchWeb(params.query);
				return {
					content: [
						{
							type: 'text' as const,
							text: results.length > 0 ? JSON.stringify(results, null, 2) : 'No results found.'
						}
					],
					details: { resultCount: results.length }
				};
			} catch (cause) {
				return {
					content: [{ type: 'text' as const, text: `Search failed: ${errorMessage(cause)}` }],
					details: {},
					isError: true
				};
			}
		}
	});
	const researchYouTube = defineTool({
		name: 'research_youtube',
		label: 'Research YouTube',
		description:
			'Search YouTube for corroborating titles and descriptions when an episode association is uncertain.',
		parameters: Type.Object({
			youtubeId: Type.String({ minLength: 11, maxLength: 11 }),
			query: Type.String({ minLength: 2, maxLength: 200 })
		}),
		async execute(_toolCallId, params) {
			researchCalls++;
			if (!knownIds.has(params.youtubeId)) {
				return {
					content: [{ type: 'text' as const, text: 'Unknown candidate ID.' }],
					details: {},
					isError: true
				};
			}
			if (researchCalls > 10) {
				return {
					content: [{ type: 'text' as const, text: 'Research limit reached; finish the review.' }],
					details: {}
				};
			}
			try {
				const search = await options.youtube.search(params.query, { type: 'video' });
				const results = search.results
					.filter((node): node is YTNodes.Video => node.is(YTNodes.Video))
					.slice(0, 8)
					.map((video) => ({
						youtubeId: video.video_id,
						title: video.title.toString(),
						channel: video.author.name,
						views: video.view_count?.toString() ?? null,
						description: truncate(video.description, 500)
					}));
				return {
					content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
					details: { resultCount: results.length }
				};
			} catch (cause) {
				return {
					content: [
						{ type: 'text' as const, text: `YouTube search failed: ${errorMessage(cause)}` }
					],
					details: {},
					isError: true
				};
			}
		}
	});
	const submitReview = defineTool({
		name: 'submit_video_review',
		label: 'Submit video review',
		description: 'Submit the final curated selections and end the review.',
		promptSnippet: 'Submit the final machine-readable video curation',
		promptGuidelines: ['Call submit_video_review exactly once as your final action.'],
		parameters: Type.Object({
			selections: Type.Array(selectionSchema, { maxItems: options.limit }),
			rejections: Type.Array(rejectionSchema, { maxItems: options.candidates.length }),
			notes: Type.String({ maxLength: 5000 })
		}),
		async execute(_toolCallId, params) {
			finalReview = {
				selections: params.selections as AiSelection[],
				rejections: params.rejections as AiRejection[],
				notes: params.notes
			};
			return {
				content: [
					{
						type: 'text' as const,
						text: `Saved ${params.selections.length} curated video selections.`
					}
				],
				details: {
					selectionCount: params.selections.length,
					rejectionCount: params.rejections.length
				},
				terminate: true
			};
		}
	});

	const systemPrompt = `You are a thorough video curator for a movie and TV discovery site. Review every supplied YouTube candidate and select every worthwhile, relevant video up to the requested limit. The goal is broad coverage, not a tiny best-of list.

Individual scenes and clips are first-class content and one of the site's most important video types. Be deliberately inclusive of good scene uploads: memorable dialogue, character moments, confrontations, action, episode-specific sequences, and short standalone clips. When enough candidates exist, scenes and clips should make up a large share of the final selection and should cover many different episodes and characters. Do not let trailers, interviews, reviews, or analysis crowd them out.

A scene does not need to come from an official studio channel. Do not reject an otherwise relevant, clear, high-resolution scene merely because its uploader is unofficial or because it contains copyrighted footage. The mechanical view, resolution, duration, and availability thresholds have already been enforced. Reject actual full or near-full pirated movies/episodes, low-effort recordings, badly altered footage, misleading/fake videos, unrelated material, and genuine duplicates. Prefer official sources when choosing between equivalent copies, but retain distinct scenes from non-official channels.

For TV, associate a video with an exact episode when its title, description, search context, or research provides reliable evidence. Otherwise use tv_season when the season is known, or tv_show when it is not. Never invent an episode association. Use supplied TMDB numbers exactly. When seasonScopeRestricted is true, reject content outside the supplied seasons. For movies always use movie.

Choose the best matching videoType. Mark containsSpoilers true for plot-revealing scenes, deleted scenes, recaps, reviews, analysis, and similar material; judge trailers, interviews, and featurettes individually. Different scenes are not duplicates. Keep no more than one entry per YouTube ID. Classify every candidate exactly once as either a selection or a rejection, and give every rejection a concrete reason. Use limit_reached only for good candidates that could not fit under the maximum. Use research_web or research_youtube when useful for provenance. Call submit_video_review exactly once as your final action; do not provide the result only as prose.`;
	const resourceLoader: ResourceLoader = {
		getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
		getSkills: () => ({ skills: [], diagnostics: [] }),
		getPrompts: () => ({ prompts: [], diagnostics: [] }),
		getThemes: () => ({ themes: [], diagnostics: [] }),
		getAgentsFiles: () => ({ agentsFiles: [] }),
		getSystemPrompt: () => systemPrompt,
		getAppendSystemPrompt: () => [],
		extendResources: () => {},
		reload: async () => {}
	};
	const settingsManager = SettingsManager.inMemory({
		compaction: { enabled: false },
		retry: { enabled: true, maxRetries: 3 }
	});
	const { session } = await createAgentSession({
		cwd: process.cwd(),
		model: options.model,
		thinkingLevel: options.thinking,
		modelRuntime: options.modelRuntime,
		resourceLoader,
		tools: ['research_web', 'research_youtube', 'submit_video_review'],
		customTools: [researchWeb, researchYouTube, submitReview],
		sessionManager: SessionManager.inMemory(process.cwd()),
		settingsManager
	});
	try {
		console.log(
			`Review model: ${session.model?.provider}/${session.model?.id}:${session.thinkingLevel}`
		);
		session.subscribe((event) => {
			if (event.type === 'tool_execution_start' && event.toolName.startsWith('research_')) {
				console.log(`  agent is using ${event.toolName}…`);
			}
			if (
				options.verbose &&
				event.type === 'message_update' &&
				event.assistantMessageEvent.type === 'text_delta'
			) {
				process.stdout.write(event.assistantMessageEvent.delta);
			}
		});
		await session.prompt(buildReviewPrompt(options.media, options.candidates, options.limit));
		if (options.verbose) process.stdout.write('\n');
		if (!finalReview) {
			throw new Error(
				session.agent.state.errorMessage || 'The pi reviewer did not call submit_video_review.'
			);
		}
		const reviewedIds = new Set<string>();
		const selections: AiSelection[] = [];
		const rejections: AiRejection[] = [];
		let ignoredClassifications = 0;
		for (const selection of finalReview.selections) {
			if (!knownIds.has(selection.youtubeId) || reviewedIds.has(selection.youtubeId)) {
				ignoredClassifications++;
				continue;
			}
			if (!resolveSelectionTarget(options.media, selection)) {
				reviewedIds.add(selection.youtubeId);
				rejections.push({
					youtubeId: selection.youtubeId,
					reason: 'insufficient_target_evidence',
					rationale: 'The AI reviewer supplied an invalid season or episode association.'
				});
				continue;
			}
			reviewedIds.add(selection.youtubeId);
			selections.push(selection);
		}
		for (const rejection of finalReview.rejections) {
			if (!knownIds.has(rejection.youtubeId) || reviewedIds.has(rejection.youtubeId)) {
				ignoredClassifications++;
				continue;
			}
			reviewedIds.add(rejection.youtubeId);
			rejections.push(rejection);
		}
		if (ignoredClassifications > 0) {
			console.warn(
				`  Ignored ${ignoredClassifications} duplicate or unknown AI classification(s).`
			);
		}
		const missingIds = [...knownIds].filter((youtubeId) => !reviewedIds.has(youtubeId));
		if (missingIds.length > 0) {
			console.warn(
				`  Reviewer omitted ${missingIds.length} candidate(s); recording them as unclassified.`
			);
			for (const youtubeId of missingIds) {
				rejections.push({
					youtubeId,
					reason: 'unclassified',
					rationale: 'The AI reviewer omitted this candidate from its final classification.'
				});
			}
		}
		return {
			selections,
			rejections,
			notes: finalReview.notes,
			model: session.model ? `${session.model.provider}/${session.model.id}` : null,
			thinking: session.thinkingLevel
		};
	} finally {
		session.dispose();
	}
}

function buildReviewPrompt(media: MediaContext, candidates: DetailedCandidate[], limit: number) {
	const episodeCount = media.seasons.reduce((sum, season) => sum + season.episodes.length, 0);
	const includeEpisodeOverviews = episodeCount <= 200;
	const mediaPayload = {
		kind: media.kind,
		tmdbId: media.tmdbId,
		title: media.title,
		originalTitle: media.originalTitle,
		year: media.year,
		overview: truncate(media.overview, 1000),
		genres: media.genres,
		keywords: media.keywords.slice(0, 40),
		people: media.people,
		seasonScopeRestricted: media.seasonScopeRestricted,
		seasons: media.seasons.map((season) => ({
			tmdbId: season.tmdbId,
			seasonNumber: season.seasonNumber,
			name: season.name,
			overview: truncate(season.overview, 350),
			episodes: season.episodes.map((episode) => ({
				tmdbId: episode.tmdbId,
				seasonNumber: episode.seasonNumber,
				episodeNumber: episode.episodeNumber,
				name: episode.name,
				...(includeEpisodeOverviews ? { overview: truncate(episode.overview, 350) } : {}),
				airDate: episode.airDate
			}))
		}))
	};
	const candidatePayload = candidates.map((candidate) => ({
		youtubeId: candidate.youtubeId,
		url: candidate.videoUrl,
		title: candidate.title,
		channel: candidate.channelName,
		views: candidate.viewCount,
		durationSeconds: candidate.durationSeconds,
		maxHeight: candidate.maxHeight,
		published: candidate.publishedLabel,
		description: truncate(candidate.description, 1200),
		searchContexts: candidate.queries,
		tmdbListing: candidate.tmdbVideo
			? {
					name: candidate.tmdbVideo.name,
					type: candidate.tmdbVideo.type,
					official: candidate.tmdbVideo.official
				}
			: null
	}));
	return `Select every worthwhile video for this title up to the limit of ${limit}; do not produce a deliberately short best-of list. Be especially inclusive of distinct individual scenes and clips, including high-quality unofficial uploads. Classify every candidate exactly once in either selections or rejections, and reserve limit_reached for otherwise-good candidates after ${limit} selections are filled.

MEDIA_CONTEXT
${JSON.stringify(mediaPayload)}

CANDIDATES
${JSON.stringify(candidatePayload)}\n`;
}

function buildAcceptedVideos(
	media: MediaContext,
	candidates: DetailedCandidate[],
	selections: AiSelection[],
	createdAt: string,
	limit: number
) {
	const candidateById = new Map(candidates.map((candidate) => [candidate.youtubeId, candidate]));
	const seen = new Set<string>();
	const accepted: Array<{
		record: VideoRecord;
		review: { confidence: number; rationale: string };
		youtube: { viewCount: number; durationSeconds: number; maxHeight: number };
	}> = [];
	for (const selection of selections) {
		if (accepted.length >= limit || seen.has(selection.youtubeId)) continue;
		const candidate = candidateById.get(selection.youtubeId);
		if (!candidate || !VIDEO_TYPES.includes(selection.videoType)) continue;
		const target = resolveSelectionTarget(media, selection);
		if (!target) {
			console.warn(`  Ignoring invalid AI target for ${selection.youtubeId}.`);
			continue;
		}
		seen.add(selection.youtubeId);
		const record: VideoRecord = {
			$type: VIDEO_COLLECTION,
			videoUrl: candidate.videoUrl,
			videoTitle: truncate(candidate.title, 500),
			...(candidate.channelName ? { channelName: truncate(candidate.channelName, 500) } : {}),
			...(validHttpsUrl(candidate.channelUrl) ? { channelUrl: candidate.channelUrl! } : {}),
			...(validHttpsUrl(candidate.thumbnailUrl) ? { thumbnailUrl: candidate.thumbnailUrl! } : {}),
			youtubeId: candidate.youtubeId,
			videoType: selection.videoType,
			creativeWorkType: target.creativeWorkType,
			identifiers: target.identifiers,
			title: truncate(target.title, 1000),
			containsSpoilers: selection.containsSpoilers,
			createdAt
		};
		accepted.push({
			record,
			review: {
				confidence: Math.max(0, Math.min(1, selection.confidence)),
				rationale: truncate(selection.rationale, 500)
			},
			youtube: {
				viewCount: candidate.viewCount,
				durationSeconds: candidate.durationSeconds,
				maxHeight: candidate.maxHeight
			}
		});
	}
	return accepted;
}

function resolveSelectionTarget(media: MediaContext, selection: AiSelection) {
	if (media.kind === 'movie') {
		return {
			creativeWorkType: 'movie' as const,
			identifiers: { tmdbId: String(media.tmdbId) },
			title: media.title
		};
	}
	if (selection.creativeWorkType === 'tv_episode') {
		const episode = media.seasons
			.find((season) => season.seasonNumber === selection.seasonNumber)
			?.episodes.find((item) => item.episodeNumber === selection.episodeNumber);
		if (!episode) return null;
		return {
			creativeWorkType: 'tv_episode' as const,
			identifiers: {
				tmdbId: String(episode.tmdbId),
				tmdbTvSeriesId: String(media.tmdbId),
				seasonNumber: episode.seasonNumber,
				episodeNumber: episode.episodeNumber
			},
			title: `${media.title}: S${episode.seasonNumber} E${episode.episodeNumber} ${episode.name}`
		};
	}
	if (selection.creativeWorkType === 'tv_season') {
		const season = media.seasons.find((item) => item.seasonNumber === selection.seasonNumber);
		if (!season) return null;
		return {
			creativeWorkType: 'tv_season' as const,
			identifiers: {
				tmdbId: String(season.tmdbId),
				tmdbTvSeriesId: String(media.tmdbId),
				seasonNumber: season.seasonNumber
			},
			title: `${media.title}: ${season.name}`
		};
	}
	return {
		creativeWorkType: 'tv_show' as const,
		identifiers: { tmdbId: String(media.tmdbId) },
		title: media.title
	};
}

async function searchWeb(query: string) {
	const url = new URL('https://html.duckduckgo.com/html/');
	url.searchParams.set('q', query);
	const response = await fetch(url, {
		headers: {
			accept: 'text/html',
			'user-agent': 'Mozilla/5.0 (compatible; atmo.watch-video-curator/1.0)'
		},
		signal: AbortSignal.timeout(15_000)
	});
	if (!response.ok) throw new Error(`DuckDuckGo returned ${response.status}`);
	const html = await response.text();
	const links = [
		...html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)
	];
	const snippets = [
		...html.matchAll(
			/<(?:a|div)[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/g
		)
	];
	return links.slice(0, 6).map((link, index) => ({
		title: cleanHtml(link[2]),
		url: unwrapDuckDuckGoUrl(decodeHtml(link[1])),
		snippet: cleanHtml(snippets[index]?.[1] ?? '')
	}));
}

function unwrapDuckDuckGoUrl(value: string) {
	try {
		const url = new URL(value, 'https://duckduckgo.com');
		return url.searchParams.get('uddg') || url.toString();
	} catch {
		return value;
	}
}

function cleanHtml(value: string) {
	return decodeHtml(
		value
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
	);
}

function decodeHtml(value: string) {
	return value
		.replaceAll('&amp;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#x27;', "'")
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

async function mapConcurrent<T, R>(
	items: T[],
	concurrency: number,
	mapper: (item: T, index: number) => Promise<R>
): Promise<Array<R | Error>> {
	const results: Array<R | Error> = new Array(items.length);
	let nextIndex = 0;
	async function worker() {
		while (true) {
			const index = nextIndex++;
			if (index >= items.length) return;
			try {
				results[index] = await mapper(items[index], index);
			} catch (cause) {
				results[index] = cause instanceof Error ? cause : new Error(String(cause));
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
	return results;
}

function parseViewCount(value: string | undefined) {
	if (!value) return 0;
	const normalized = value.toLowerCase().replaceAll(',', '').trim();
	const match = /([\d.]+)\s*([kmb])?/.exec(normalized);
	if (!match) return 0;
	const multiplier = match[2] === 'b' ? 1e9 : match[2] === 'm' ? 1e6 : match[2] === 'k' ? 1e3 : 1;
	return Math.round(Number(match[1]) * multiplier);
}

function increment(record: Record<string, number>, key: string) {
	record[key] = (record[key] ?? 0) + 1;
}

function truncate(value: string, maximum: number) {
	return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

function validHttpsUrl(value: string | null): value is string {
	if (!value || value.length > 2048) return false;
	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
}

function slugify(value: string) {
	return (
		value
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 80) || 'title'
	);
}

async function writeJsonAtomic(filename: string, value: unknown) {
	await mkdir(path.dirname(filename), { recursive: true });
	const temporary = `${filename}.${process.pid}.tmp`;
	await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
	await rename(temporary, filename);
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
