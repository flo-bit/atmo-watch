import { Contrail } from '@atmo-dev/contrail';
import { createHandler } from '@atmo-dev/contrail/server';
import { config } from '$lib/contrail.config';
import { lexicons } from '../../../../lexicons/generated';

// Bind lazily: D1 is unavailable during build/prerender. Share concurrent init
// per binding, and allow a failed initialization to retry on the next request.
const instances = new WeakMap<
	D1Database,
	{ contrail: Contrail; handle: ReturnType<typeof createHandler>; ready?: Promise<void> }
>();

function instance(db: D1Database) {
	let state = instances.get(db);
	if (!state) {
		const contrail = new Contrail({ ...config, lexicons });
		state = { contrail, handle: createHandler(contrail, { lexicons }) };
		instances.set(db, state);
	}
	return state;
}

export async function ensureInit(db: D1Database): Promise<Contrail> {
	const state = instance(db);
	state.ready ??= state.contrail.init(db, { deferModerationPolicyJob: true }).catch((error) => {
		state.ready = undefined;
		throw error;
	});
	await state.ready;
	return state.contrail;
}

export async function handleContrailRequest(request: Request, db: D1Database): Promise<Response> {
	await ensureInit(db);
	return instance(db).handle(request, db);
}
