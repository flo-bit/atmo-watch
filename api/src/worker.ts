import { createWorker } from '@atmo-dev/contrail/worker';
import { lexicons } from '../lexicons/generated';
import { config } from './contrail.config';

const productionEndpoint = 'https://api.atmo.watch';
const workers = new Map<string, ReturnType<typeof createWorker>>();
type WorkerEnv = Record<string, unknown> & { CONTRAIL_PUBLIC_ENDPOINT?: string };

function getWorker(endpoint: string) {
	let worker = workers.get(endpoint);
	if (!worker) {
		worker = createWorker(config, {
			lexicons,
			publicService: {
				endpoint,
				allowInsecureHttp: endpoint.startsWith('http://')
			}
		});
		workers.set(endpoint, worker);
	}
	return worker;
}

export default {
	fetch(request: Request, env: WorkerEnv) {
		return getWorker(env.CONTRAIL_PUBLIC_ENDPOINT ?? productionEndpoint).fetch(request, env);
	},
	scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext) {
		return getWorker(env.CONTRAIL_PUBLIC_ENDPOINT ?? productionEndpoint).scheduled(event, env, ctx);
	}
};
