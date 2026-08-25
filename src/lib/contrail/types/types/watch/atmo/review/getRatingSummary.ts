import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.query(
	"watch.atmo.review.getRatingSummary",
	{
		"params": /*#__PURE__*/ v.object(
			{
				"creativeWorkType": /*#__PURE__*/ v.string<"movie" | "tv_show" | (string & {})>(),
				/**
				 * @minimum 1
				 */
				"tmdbId": /*#__PURE__*/ v.constrain(
					/*#__PURE__*/ v.integer(),
					[/*#__PURE__*/ v.integerRange(1)]
				),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * @minimum 0
					 */
					"count": /*#__PURE__*/ v.integer(),
					/**
					 * Average rating as a decimal string.
					 */
					"score": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
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
		"watch.atmo.review.getRatingSummary": mainSchema;
	}
}
