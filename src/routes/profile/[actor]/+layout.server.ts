import { getActorProfile } from '$lib/profiles.server';
import { isActorIdentifier } from '@atcute/lexicons/syntax';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

function parseActor(value: string) {
	if (isActorIdentifier(value)) return value;

	try {
		const decoded = decodeURIComponent(value);
		return isActorIdentifier(decoded) ? decoded : undefined;
	} catch {
		return undefined;
	}
}

export const load: LayoutServerLoad = async ({ params }) => {
	const actor = parseActor(params.actor);
	if (!actor) error(404, 'Profile not found');

	const profile = await getActorProfile(actor).catch((cause) => {
		console.error('Could not load profile from Contrail', cause);
		error(502, 'Could not load profile');
	});
	if (!profile) error(404, 'Profile not found');

	return { profile };
};
