import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMediaArtworkCurator, setMediaArtworkOverride } from '$lib/media-curation.server';
import { getMediaArtworkEditor, TMDBError } from '$lib/tmdb.server';
import { parseMediaRouteKind, parseTmdbId } from '$lib/utils';

function requireCurator(locals: App.Locals) {
	if (!locals.did) error(401, 'Log in to edit media artwork');
	if (!isMediaArtworkCurator(locals.did)) error(403, 'You cannot edit media artwork');
	return locals.did;
}

function parseIdentity(params: { kind: string; id: string }) {
	const tmdbId = parseTmdbId(params.id);
	const creativeWorkType = parseMediaRouteKind(params.kind);
	if (!tmdbId || !creativeWorkType) error(404, 'Not found');
	return { tmdbId, creativeWorkType };
}

function parsePath(formData: FormData, name: string) {
	const value = formData.get(name);
	if (typeof value !== 'string' || value.length > 500) return undefined;
	return value || null;
}

async function loadEditor(tmdbId: number, creativeWorkType: 'movie' | 'tv_show') {
	try {
		return await getMediaArtworkEditor(tmdbId, creativeWorkType);
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) error(404, 'Not found');
		throw cause;
	}
}

export const load: PageServerLoad = async ({ locals, params }) => {
	requireCurator(locals);
	const { tmdbId, creativeWorkType } = parseIdentity(params);
	return loadEditor(tmdbId, creativeWorkType);
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const did = requireCurator(locals);
		const { tmdbId, creativeWorkType } = parseIdentity(params);
		const formData = await request.formData();
		const submittedBackdropPath = parsePath(formData, 'backdropPath');
		const submittedLogoPath = parsePath(formData, 'logoPath');

		if (submittedBackdropPath === undefined || submittedLogoPath === undefined) {
			return fail(400, {
				success: false,
				message: 'The artwork selection is invalid.',
				backdropPath: submittedBackdropPath ?? null,
				logoPath: submittedLogoPath ?? null
			});
		}

		const editor = await loadEditor(tmdbId, creativeWorkType);
		const backdropPaths = new Set(
			editor.backdrops.flatMap((image) => (image.source === 'tmdb' ? [image.path] : []))
		);
		const logoPaths = new Set(editor.logos.map((logo) => logo.path));
		if (submittedBackdropPath && !backdropPaths.has(submittedBackdropPath)) {
			return fail(400, {
				success: false,
				message: 'That backdrop is no longer available from TMDB.',
				backdropPath: submittedBackdropPath,
				logoPath: submittedLogoPath
			});
		}
		if (submittedLogoPath && !logoPaths.has(submittedLogoPath)) {
			return fail(400, {
				success: false,
				message: 'That wordmark is no longer available from TMDB.',
				backdropPath: submittedBackdropPath,
				logoPath: submittedLogoPath
			});
		}

		const backdropPath =
			submittedBackdropPath === editor.defaultBackdropPath ? null : submittedBackdropPath;
		const logoPath = submittedLogoPath === editor.defaultLogoPath ? null : submittedLogoPath;

		try {
			const result = await setMediaArtworkOverride({
				creativeWorkType,
				tmdbId,
				backdropPath,
				logoPath,
				updatedBy: did
			});
			return {
				success: true,
				message:
					result.override === null
						? 'Restored the TMDB artwork defaults.'
						: 'Saved the artwork selection.',
				backdropPath,
				logoPath,
				updatedAt: result.revision
			};
		} catch (cause) {
			console.error(`Could not save artwork for ${creativeWorkType} ${tmdbId}`, cause);
			return fail(503, {
				success: false,
				message: 'Could not save the artwork selection. Try again.',
				backdropPath,
				logoPath
			});
		}
	}
};
