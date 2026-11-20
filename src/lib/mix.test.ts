import { describe, expect, it } from 'vitest';
import {
	addTopRated,
	MIX_MAX_PICKS,
	MIX_TOP_RATED,
	mixSearch,
	parseMixPicks,
	rankMix,
	type MixSource
} from './mix';
import type { MediaSummary, SupportedCreativeWorkType } from './types';

function media(
	tmdbId: number,
	creativeWorkType: SupportedCreativeWorkType = 'movie'
): MediaSummary {
	return {
		tmdbId,
		creativeWorkType,
		title: `Title ${tmdbId}`,
		poster: { source: 'tmdb', path: '/p.jpg' }
	};
}

function source(pick: MediaSummary, recommendations: MediaSummary[]): MixSource {
	return { pick, recommendations: recommendations.map((item) => ({ ...item, voteCount: 0 })) };
}

describe('mix picks in the URL', () => {
	it('reads movies and shows, ignoring invalid and duplicate ids', () => {
		const picks = parseMixPicks(new URLSearchParams('m=603,abc,603,0,-4,27205&t=1396,'));
		expect(picks).toEqual([
			{ creativeWorkType: 'movie', tmdbId: 603 },
			{ creativeWorkType: 'movie', tmdbId: 27205 },
			{ creativeWorkType: 'tv_show', tmdbId: 1396 }
		]);
	});

	it('caps the number of picks', () => {
		const ids = Array.from({ length: 30 }, (_, index) => index + 1).join(',');
		expect(parseMixPicks(new URLSearchParams(`m=${ids}&t=${ids}`))).toHaveLength(MIX_MAX_PICKS);
	});

	it('round-trips through the query string', () => {
		const picks = parseMixPicks(new URLSearchParams('t=1396&m=603,27205'));
		expect(mixSearch(picks)).toBe('?m=603,27205&t=1396');
		expect(mixSearch([])).toBe('');
	});
});

describe('adding the highest rated titles', () => {
	const rated = Array.from({ length: 40 }, (_, index) => media(100 + index));
	const picks = (count: number) => Array.from({ length: count }, (_, index) => media(index + 1));

	it('adds the top rated titles in order when few are picked', () => {
		const result = addTopRated(picks(4), rated);
		expect(result).toHaveLength(4 + MIX_TOP_RATED);
		expect(result.slice(4).map((item) => item.tmdbId)).toEqual(
			rated.slice(0, MIX_TOP_RATED).map((item) => item.tmdbId)
		);
	});

	it('fills up to the pick limit once more are picked', () => {
		expect(addTopRated(picks(5), rated)).toHaveLength(MIX_MAX_PICKS);
		expect(addTopRated(picks(12), rated)).toHaveLength(MIX_MAX_PICKS);
		expect(addTopRated(picks(MIX_MAX_PICKS), rated)).toHaveLength(MIX_MAX_PICKS);
	});

	it('skips titles that are already picked and takes the next best instead', () => {
		const result = addTopRated([rated[0], rated[2]], rated);
		expect(result).toHaveLength(2 + MIX_TOP_RATED);
		expect(new Set(result.map((item) => item.tmdbId)).size).toBe(result.length);
		expect(result.at(-1)?.tmdbId).toBe(rated[MIX_TOP_RATED + 1].tmdbId);
	});

	it('adds what there is when few titles are rated', () => {
		expect(addTopRated(picks(1), rated.slice(0, 3))).toHaveLength(4);
	});
});

describe('mix ranking', () => {
	it('puts titles shared by more picks first', () => {
		const results = rankMix([
			source(media(1), [media(10), media(11), media(12)]),
			source(media(2), [media(13), media(12)])
		]);
		expect(results.map((item) => item.tmdbId)).toEqual([12, 10, 13, 11]);
	});

	it('keeps movies and shows with the same id apart', () => {
		const results = rankMix([
			source(media(1), [media(10)]),
			source(media(2, 'tv_show'), [media(10, 'tv_show')])
		]);
		expect(results).toHaveLength(2);
	});

	it('leaves out picks, excluded titles and titles without a poster', () => {
		const results = rankMix(
			[
				source(media(1), [media(2), media(10), { ...media(11), poster: null }, media(12)]),
				source(media(2), [media(1), media(12)])
			],
			new Set(['movie:12'])
		);
		expect(results.map((item) => item.tmdbId)).toEqual([10]);
	});

	it('prefers titles that suit more people over titles one person matches often', () => {
		const owned = (owner: string, pick: MediaSummary, recommendations: MediaSummary[]) => ({
			...source(pick, recommendations),
			owner
		});
		const results = rankMix([
			owned('a', media(1), [media(10), media(11)]),
			owned('a', media(2), [media(10)]),
			owned('a', media(3), [media(10)]),
			owned('b', media(4), [media(12), media(11)])
		]);
		expect(results.map((item) => item.tmdbId)).toEqual([11, 10, 12]);
	});

	it('limits the number of results', () => {
		const many = Array.from({ length: 20 }, (_, index) => media(100 + index));
		expect(rankMix([source(media(1), many)], new Set(), 5)).toHaveLength(5);
	});
});
