import { page } from 'vitest/browser';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { loginDialog } from '../login.svelte';
import WatchedButton from './WatchedButton.svelte';
import '../../routes/layout.css';

const request = vi.hoisted(() => vi.fn());
vi.mock('$lib/list-write.remote', () => ({ setWatchedStatus: request }));

const item = { title: 'Alien', creativeWorkType: 'movie' as const, tmdbId: 348, poster: null };

beforeEach(() => {
	request.mockReset();
});
afterEach(() => loginDialog.hide());

it('sends the intended watched value without depending on a parent prop update', async () => {
	request.mockResolvedValue({ watched: true });
	const onStateChange = vi.fn();
	const { rerender } = render(WatchedButton, {
		item,
		did: 'did:plc:viewer',
		state: { lists: [], watched: false },
		onStateChange
	});
	const button = page.getByRole('button', { name: 'Mark as watched', exact: true });
	await button.click();
	await expect.poll(() => request.mock.calls.length).toBe(1);
	expect(request).toHaveBeenLastCalledWith({
		media: { creativeWorkType: 'movie', tmdbId: 348, title: 'Alien' },
		watched: true
	});
	expect(button.element().getAttribute('data-slot')).toBeNull();

	request.mockResolvedValue({ watched: false });
	await rerender({ state: { lists: [], watched: true } });
	const undo = page.getByRole('button', { name: 'Mark as unwatched', exact: true });
	await expect.element(undo).toHaveAttribute('aria-pressed', 'true');
	await undo.click();
	await expect.poll(() => request.mock.calls.length).toBe(2);
	expect(request.mock.calls[1][0].watched).toBe(false);
});

it('rolls back an optimistic update when saving fails', async () => {
	request.mockRejectedValue(new Error('Could not save'));
	const onStateChange = vi.fn();
	render(WatchedButton, {
		item,
		did: 'did:plc:viewer',
		state: { lists: [], watched: false },
		onStateChange
	});
	await page.getByRole('button', { name: 'Mark as watched', exact: true }).click();
	await expect.poll(() => onStateChange.mock.calls.length).toBe(2);
	expect(onStateChange.mock.calls.map(([state]) => state.watched)).toEqual([true, false]);
	await expect
		.element(page.getByRole('button', { name: 'Mark as watched', exact: true }))
		.toBeEnabled();
});

it('opens login rather than writing a record when signed out', async () => {
	render(WatchedButton, { item, did: null });
	await page.getByRole('button', { name: 'Mark as watched', exact: true }).click();
	expect(loginDialog.open).toBe(true);
	expect(request).not.toHaveBeenCalled();
});
