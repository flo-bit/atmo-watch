import type { PageServerLoad } from './$types';
import { getHomePage } from './_lib/tmdb.server';

export const load: PageServerLoad = async () => getHomePage();
