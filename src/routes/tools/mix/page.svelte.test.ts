import { page } from 'vitest/browser';
import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { MediaSummary } from '$lib/types';
const mocks = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));

import MixPage from './+page.svelte';
import '../../layout.css';

function media(tmdbId: number, title: string): MediaSummary {
	return { tmdbId, creativeWorkType: 'movie', title, poster: null };
}

const rated = [media(1, 'Alien'), media(2, 'Heat'), media(3, 'Ronin')];

function data(picks: MediaSummary[], ratedTitles = rated) {
	return {
		did: 'did:plc:viewer' as const,
		avatarUrl: undefined,
		picks,
		results: [],
		rated: ratedTitles,
		unavailable: false
	};
}

it('offers rated titles that are not picked yet', async () => {
	render(MixPage, { data: data([rated[1]]) });
	await expect.element(page.getByRole('button', { name: 'Add Alien', exact: true })).toBeVisible();
	await expect.element(page.getByRole('button', { name: 'Add Ronin', exact: true })).toBeVisible();
	await expect
		.element(page.getByRole('button', { name: 'Add Heat', exact: true }))
		.not.toBeInTheDocument();
	await expect
		.element(page.getByRole('button', { name: 'Remove Heat', exact: true }))
		.toBeVisible();
});

it('shows no ratings row without rated titles', async () => {
	render(MixPage, { data: data([], []) });
	await expect.element(page.getByPlaceholder('Add a movie or show…')).toBeVisible();
	await expect.element(page.getByText('From your ratings')).not.toBeInTheDocument();
});

it('adds the highest rated titles that are not picked yet', async () => {
	render(MixPage, { data: data([rated[1]]) });
	await page.getByRole('button', { name: 'choose my highest rated', exact: true }).click();
	expect(mocks.goto).toHaveBeenCalledWith('/tools/mix?m=2,1,3', expect.anything());
});
