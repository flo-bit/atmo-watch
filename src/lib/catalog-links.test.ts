import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import ItemCard from '$lib/components/ItemCard.svelte';
import ItemsGrid from '$lib/components/ItemsGrid.svelte';
import type { MediaSummary } from '$lib/types';

vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string>) =>
		route.replace(/\[(\w+)\]/g, (_, key: string) => params[key])
}));

const item: MediaSummary = {
	tmdbId: 123,
	creativeWorkType: 'movie',
	title: 'Example',
	poster: null
};

describe('selective catalog link hints', () => {
	it.each([true, false])(
		'marks both card layouts nofollow when requested (showTitle=%s)',
		(showTitle) => {
			const { body } = render(ItemCard, { props: { item, showTitle, nofollow: true } });
			expect(body).toContain('rel="nofollow"');
			expect(body).toContain('href="/movie/123-example"');
		}
	);

	it('does not mark community/discovery cards nofollow by default', () => {
		const { body } = render(ItemCard, { props: { item } });
		expect(body).not.toContain('nofollow');
	});

	it('propagates nofollow through recommendation/filmography grids only when requested', () => {
		const nofollow = render(ItemsGrid, { props: { items: [item], nofollow: true } }).body;
		const normal = render(ItemsGrid, { props: { items: [item] } }).body;
		expect(nofollow).toContain('rel="nofollow"');
		expect(normal).not.toContain('nofollow');
	});
});
