import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _itemSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.review.getTopRated#item")),
		/**
		 * @minimum 1
		 */
		"count": /*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.integer(),
			[/*#__PURE__*/ v.integerRange(1)]
		),
		"creativeWorkType": /*#__PURE__*/ v.string<"movie" | "tv_show" | (string & {})>(),
		/**
		 * Average rating in the 30-day window as a decimal string.
		 */
		"score": /*#__PURE__*/ v.string(),
		/**
		 * @minimum 1
		 */
		"tmdbId": /*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.integer(),
			[/*#__PURE__*/ v.integerRange(1)]
		),
		/**
		 * Bayesian ranking score as a decimal string.
		 */
		"weightedScore": /*#__PURE__*/ v.string(),
	}
);
const _mainSchema = /*#__PURE__*/ v.query(
	"watch.atmo.review.getTopRated",
	{
		"params": null,
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * @maxLength 10
					 */
					get "items"() {
						return /*#__PURE__*/ v.constrain(
							/*#__PURE__*/ v.array(itemSchema),
							[/*#__PURE__*/ v.arrayLength(0, 10)]
						)
					},
					/**
					 * @minimum 0
					 */
					"priorCount": /*#__PURE__*/ v.integer(),
					/**
					 * Prior rating as a decimal string.
					 */
					"priorScore": /*#__PURE__*/ v.string(),
					/**
					 * @minimum 1
					 */
					"windowDays": /*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1)]
					),
				}
			),
		}
	}
);
type item$schematype = typeof _itemSchema;
type main$schematype = typeof _mainSchema;

export interface itemSchema extends item$schematype {}

export interface mainSchema extends main$schematype {}
export const itemSchema = _itemSchema as itemSchema;
export const mainSchema = _mainSchema as mainSchema;

export interface Item extends v.InferInput<typeof itemSchema> {}

export interface $params {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"watch.atmo.review.getTopRated": mainSchema;
	}
}
