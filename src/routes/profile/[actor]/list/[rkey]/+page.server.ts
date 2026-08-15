import type { ResourceUri } from '@atcute/lexicons';
import { isRecordKey } from '@atcute/lexicons/syntax';
import { error } from '@sveltejs/kit';
import { getMediaListPage } from '$lib/lists.server';
import type { PageServerLoad } from './$types';

function parsePage(value: string | null) {
	if (!value || !/^\d+$/.test(value)) return 1;
	const page = Number(value);
	return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export const load: PageServerLoad = async ({ params, parent, url }) => {
	if (!isRecordKey(params.rkey)) error(404, 'List not found');

	const { profile } = await parent();
	const uri = `at://${profile.did}/social.popfeed.feed.list/${params.rkey}` as ResourceUri;
	const result = await getMediaListPage({
		uri,
		author: profile,
		page: parsePage(url.searchParams.get('page'))
	});

	if (!result.response.ok) {
		if (result.response.status === 400 || result.response.status === 404) {
			error(404, 'List not found');
		}
		error(502, 'Could not load list');
	}
	if (
		!('list' in result) ||
		!result.list ||
		!result.items ||
		result.currentPage === undefined ||
		result.totalPages === undefined
	) {
		error(502, 'Could not load list');
	}

	return {
		list: result.list,
		items: result.items,
		currentPage: result.currentPage,
		totalPages: result.totalPages
	};
};
