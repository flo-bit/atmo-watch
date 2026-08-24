import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as WatchAtmoVideoListRecords from "./listRecords.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"watch.atmo.video.listRandomRecords",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * @minimum 1
				 * @maximum 200
				 * @default 24
				 */
				"limit": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1, 200)]
					),
					24
				),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					get "records"() {
						return /*#__PURE__*/ v.array(WatchAtmoVideoListRecords.recordSchema)
					},
				}
			),
		}
	}
);
type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}
export const mainSchema = _mainSchema as mainSchema;

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"watch.atmo.video.listRandomRecords": mainSchema;
	}
}
