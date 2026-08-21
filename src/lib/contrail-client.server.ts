import { env } from '$env/dynamic/private';
import {
	contrail as productionContrail,
	contrailApi,
	contrailMethods as productionContrailMethods,
	createLocalContrailClient
} from '$lib/contrail/index.js';

const localEndpoint = env.CONTRAIL_URL;

export const contrail = localEndpoint
	? createLocalContrailClient(localEndpoint)
	: productionContrail;
export const contrailMethods = localEndpoint
	? contrailApi.serviceMethods
	: productionContrailMethods;
