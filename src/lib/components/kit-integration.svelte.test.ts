import { page, userEvent } from 'vitest/browser';
import { expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import WatchControls from '../testing/WatchControls.svelte';
import '../../routes/layout.css';

it('preserves compact avatars and portrait cast photos with Kit sizing', async () => {
	render(WatchControls);
	const avatar = page.getByRole('img', { name: 'Viewer', exact: true });
	const cast = page.getByRole('img', { name: 'Cast member', exact: true });
	await expect.element(avatar).toBeVisible();
	expect(avatar.element().getBoundingClientRect().width).toBe(28);
	expect(avatar.element().getBoundingClientRect().height).toBe(28);
	expect(cast.element().getBoundingClientRect().width).toBe(96);
	expect(cast.element().getBoundingClientRect().height).toBe(120);
	const image = cast.element().querySelector('img')!;
	await expect.poll(() => image.naturalWidth).toBe(80);
	expect(image.getBoundingClientRect().width).toBe(94);
	expect(image.getBoundingClientRect().height).toBe(118);
	expect(avatar.element().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
});

it('keeps a view selected and supports keyboard navigation', async () => {
	render(WatchControls);
	const movies = page.getByRole('radio', { name: 'Movies', exact: true });
	await movies.click();
	await expect.element(movies).toHaveAttribute('aria-checked', 'true');
	await expect.element(page.getByLabelText('Selected view')).toHaveTextContent('movies');
	await userEvent.keyboard('{ArrowRight}{Space}');
	await expect
		.element(page.getByRole('radio', { name: 'TV shows', exact: true }))
		.toHaveAttribute('aria-checked', 'true');
	await expect.element(page.getByLabelText('Selected view')).toHaveTextContent('tv');
});

it('preserves half-star rating values and native radio keyboard behavior', async () => {
	render(WatchControls);
	const halfStar = page.getByRole('radio', { name: '0.5 out of 5 stars', exact: true });
	await halfStar.click();
	await expect.element(halfStar).toBeChecked();
	const starPath = halfStar.element().parentElement!.querySelector('svg path')!;
	expect(getComputedStyle(starPath).fill).not.toBe('none');
	await expect.element(page.getByLabelText('Selected rating')).toHaveTextContent('1');
	await userEvent.keyboard('{ArrowRight}');
	await expect
		.element(page.getByRole('radio', { name: '1 out of 5 stars', exact: true }))
		.toBeChecked();
	await expect.element(page.getByLabelText('Selected rating')).toHaveTextContent('2');
});

it('keeps navigation links native, named once, and marked current', async () => {
	render(WatchControls);
	const link = page.getByRole('link', { name: 'Videos', exact: true });
	await expect.element(link).toHaveAttribute('href', '/videos');
	await expect.element(link).toHaveAttribute('aria-current', 'page');
});

it('carries Watch’s dark fuchsia theme into portals and restores focus', async () => {
	render(WatchControls);
	const trigger = page.getByRole('button', { name: 'Open dialog', exact: true });
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Watch dialog', exact: true });
	await expect.element(dialog).toBeVisible();
	expect(getComputedStyle(dialog.element()).colorScheme).toBe('dark');
	const origin = page.getByTestId('watch-theme').element();
	expect(getComputedStyle(dialog.element()).getPropertyValue('--accent-400')).toBe(
		getComputedStyle(origin).getPropertyValue('--accent-400')
	);
	expect(document.activeElement).toBe(
		page.getByRole('textbox', { name: 'Title', exact: true }).element()
	);
	await userEvent.keyboard('{Escape}');
	await expect.element(dialog).not.toBeInTheDocument();
	expect(document.activeElement).toBe(trigger.element());
});
