import { env } from '$env/dynamic/private';
import { contrail as productionContrail, createLocalContrailClient } from '$lib/contrail/index.js';

const localEndpoint = env.CONTRAIL_URL;

export const contrail = localEndpoint
	? createLocalContrailClient(localEndpoint)
	: productionContrail;
