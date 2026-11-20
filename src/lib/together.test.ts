import { describe, expect, it } from 'vitest';
import {
	chooseSeeds,
	parseTogetherActors,
	rankWatchlists,
	togetherSearch,
	TOGETHER_MAX_PEOPLE
} from './together';
import type { MediaSummary } from './types';

const media = (tmdbId: number, creativeWorkType: 'movie' | 'tv_show' = 'movie'): MediaSummary => ({
	tmdbId,
	creativeWorkType,
	title: `Title ${tmdbId}`,
	poster: null
});
const ids = (items: MediaSummary[]) => items.map((item) => item.tmdbId);

describe('people in the URL', () => {
	it('reads handles and DIDs, tidying and dropping invalid or repeated ones', () => {
		const params = new URLSearchParams({
			u: '@Alice.Example, bob.example,alice.example,did:plc:257wekqxg4hyapkq6k47igmp,nope,,a b'
		});
		expect(parseTogetherActors(params)).toEqual([
			'alice.example',
			'bob.example',
			'did:plc:257wekqxg4hyapkq6k47igmp'
		]);
	});

	it('caps the number of people', () => {
		const u = Array.from({ length: 12 }, (_, index) => `p${index}.example`).join(',');
		expect(parseTogetherActors(new URLSearchParams({ u }))).toHaveLength(TOGETHER_MAX_PEOPLE);
	});

	it('round-trips through the query string', () => {
		expect(togetherSearch(['alice.example', 'bob.example'])).toBe('?u=alice.example,bob.example');
		expect(togetherSearch([])).toBe('');
		expect(parseTogetherActors(new URLSearchParams('u=alice.example,bob.example'))).toEqual([
			'alice.example',
			'bob.example'
		]);
	});
});

describe('watchlist ranking', () => {
	it('puts titles on more watchlists first and hides watched ones', () => {
		const results = rankWatchlists(
			[
				[media(1), media(2), media(3)],
				[media(4), media(3), media(5)]
			],
			new Set(['movie:5'])
		);
		expect(ids(results)).toEqual([3, 1, 4, 2]);
	});

	it('keeps movies and shows with the same id apart', () => {
		expect(rankWatchlists([[media(1)], [media(1, 'tv_show')]], new Set())).toHaveLength(2);
	});
});

describe('choosing favourites to base suggestions on', () => {
	it('takes turns between people', () => {
		const seeds = chooseSeeds([[media(1), media(2), media(3)], [media(10)]], 3);
		expect(seeds.map((seed) => [seed.owner, seed.pick.tmdbId])).toEqual([
			[0, 1],
			[1, 10],
			[0, 2]
		]);
	});

	it('keeps a favourite two people share once for each of them', () => {
		const seeds = chooseSeeds([[media(1)], [media(1)]]);
		expect(seeds.map((seed) => seed.owner)).toEqual([0, 1]);
	});

	it('returns nothing without favourites', () => {
		expect(chooseSeeds([[], []])).toEqual([]);
	});
});
