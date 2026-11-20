import { page } from 'vitest/browser';
import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { MediaSummary } from '$lib/types';
const mocks = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));

import TogetherPage from './+page.svelte';
import '../../layout.css';

const media = (tmdbId: number, title: string): MediaSummary => ({
	tmdbId,
	creativeWorkType: 'movie',
	title,
	poster: null
});
const person = (name: string, empty = false) => ({
	did: `did:plc:${name}` as const,
	handle: `${name}.example`,
	displayName: undefined,
	avatarUrl: undefined,
	empty
});

function data(overrides: Record<string, unknown> = {}) {
	return {
		did: null,
		avatarUrl: undefined,
		people: [person('alice'), person('bob')],
		missing: [] as string[],
		watchlist: [media(1, 'Alien')],
		suggestions: [media(2, 'Heat')],
		unavailable: false,
		...overrides
	};
}

beforeEach(() => mocks.goto.mockClear());

it('shows watchlist titles before suggestions from ratings', async () => {
	render(TogetherPage, { data: data() });
	await expect.element(page.getByText('From your watchlists')).toBeVisible();
	await expect.element(page.getByText('Based on what you rated')).toBeVisible();
	await expect.element(page.getByRole('link', { name: 'Alien', exact: true })).toBeVisible();
	await expect.element(page.getByRole('link', { name: 'Heat', exact: true })).toBeVisible();
});

it('adds a typed handle and rejects something that is not one', async () => {
	render(TogetherPage, { data: data() });
	const input = page.getByLabelText('Add a person');
	await input.fill('not a handle');
	(input.element() as HTMLInputElement).form!.requestSubmit();
	await expect.element(page.getByText('Enter a full handle.')).toBeVisible();
	expect(mocks.goto).not.toHaveBeenCalled();

	await input.fill('@Carol.Example');
	(input.element() as HTMLInputElement).form!.requestSubmit();
	expect(mocks.goto).toHaveBeenCalledWith(
		'/tools/together?u=alice.example,bob.example,carol.example',
		expect.anything()
	);
	await expect.element(input).toHaveValue('');
});

it('removes a person', async () => {
	render(TogetherPage, { data: data() });
	await page.getByRole('button', { name: 'Remove alice.example', exact: true }).click();
	expect(mocks.goto).toHaveBeenCalledWith('/tools/together?u=bob.example', expect.anything());
});

it('offers to add the signed-in viewer until they are in the group', async () => {
	const { rerender } = render(TogetherPage, { data: data({ did: 'did:plc:viewer' }) });
	await page.getByRole('button', { name: 'add me', exact: true }).click();
	expect(mocks.goto).toHaveBeenCalledWith(
		'/tools/together?u=alice.example,bob.example,did:plc:viewer',
		expect.anything()
	);

	await rerender({ data: data({ did: 'did:plc:alice' }) });
	await expect
		.element(page.getByRole('button', { name: 'add me', exact: true }))
		.not.toBeInTheDocument();
});

it('explains missing people, empty libraries and a group that is too small', async () => {
	render(TogetherPage, {
		data: data({
			people: [person('alice', true)],
			missing: ['nobody.example'],
			watchlist: [],
			suggestions: []
		})
	});
	await expect.element(page.getByText('Could not find nobody.example.')).toBeVisible();
	await expect
		.element(page.getByText('alice.example has not rated or saved anything yet.'))
		.toBeVisible();
	await expect.element(page.getByText('Add one more person.')).toBeVisible();
});
