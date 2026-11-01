import { page, userEvent } from 'vitest/browser';
import { expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BackdropGallery from './BackdropGallery.svelte';
import Footer from './Footer.svelte';
import Rating from './Rating.svelte';
import '../../routes/layout.css';

const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="45"><rect width="80" height="45" fill="gray"/></svg>')}`;

it('uses Kit’s fullscreen carousel for backdrops and returns focus to the thumbnail', async () => {
	render(BackdropGallery, {
		images: [
			{ source: 'remote', url: image },
			{ source: 'remote', url: `${image}#2` }
		],
		title: 'Alien'
	});
	const trigger = page.getByRole('button', { name: 'Open backdrop 2 of 2 for Alien' });
	await trigger.click();
	await expect.element(page.getByRole('dialog')).toBeVisible();
	await expect
		.element(page.getByRole('status', { name: 'Photo position' }))
		.toHaveTextContent('2 / 2');
	await page.getByRole('button', { name: 'Next photo' }).click();
	await expect.element(page.getByRole('img', { name: 'Backdrop 1 for Alien' })).toBeVisible();
	await userEvent.keyboard('{ArrowLeft}');
	await expect
		.element(page.getByRole('status', { name: 'Photo position' }))
		.toHaveTextContent('2 / 2');
	await userEvent.keyboard('{Escape}');
	await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	expect(document.activeElement).toBe(trigger.element());
});

it('fills sketchy rating paths and preserves clipped half stars', async () => {
	render(Rating, { rating: 7 });
	const rating = page.getByRole('img', { name: '7 out of 10, 3.5 out of 5 stars' }).element();
	const paths = [...rating.querySelectorAll('path')];
	expect(paths).toHaveLength(9);
	for (const path of paths) expect(getComputedStyle(path).fill).not.toBe('none');
	const half = rating.querySelector<HTMLElement>('[style="width: 50%;"]');
	expect(half).not.toBeNull();
	expect(getComputedStyle(half!).overflow).toBe('hidden');
});

it('shows TMDB attribution above the Kit legal footer with working contact destinations', async () => {
	render(Footer);
	const footer = page.getByRole('navigation', { name: 'Legal and contact' });
	await expect
		.element(footer.getByRole('link', { name: 'Terms' }))
		.toHaveAttribute('href', '/terms');
	await expect
		.element(footer.getByRole('link', { name: 'Privacy' }))
		.toHaveAttribute('href', '/privacy');
	await expect
		.element(footer.getByRole('link', { name: 'Imprint' }))
		.toHaveAttribute('href', '/imprint');
	await expect
		.element(footer.getByRole('link', { name: 'reports@atmo.social' }))
		.toHaveAttribute('href', 'mailto:reports@atmo.social');
	const tmdb = page.getByRole('link', { name: 'The Movie Database' }).element();
	expect(
		Boolean(tmdb.compareDocumentPosition(footer.element()) & Node.DOCUMENT_POSITION_FOLLOWING)
	).toBe(true);
});
