import { legalDocuments, type LegalPage } from '$lib/legal';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => ({
	document: legalDocuments[params.policy as LegalPage]
});
