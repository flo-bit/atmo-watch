import type { ParamMatcher } from '@sveltejs/kit';

export const match: ParamMatcher = (param) => ['terms', 'privacy', 'imprint'].includes(param);
