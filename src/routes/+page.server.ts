import type { PageServerLoad } from './$types';
import { getHomePage } from '$lib/tmdb.server';

export const load: PageServerLoad = async () => getHomePage();
