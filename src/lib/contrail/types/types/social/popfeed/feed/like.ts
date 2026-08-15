import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("social.popfeed.feed.like"),
			/**
			 * Client-declared timestamp when this like was created.
			 */
			"createdAt": /*#__PURE__*/ v.datetimeString(),
			/**
			 * The type of subject being liked, e.g., 'review'.
			 */
			"subjectType": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literalEnum([
				"comment",
				"list",
				"post",
				"review"
			])),
			/**
			 * The type of subject being liked, e.g., 'review'.
			 */
			"subjectUri": /*#__PURE__*/ v.genericUriString(),
		}
	)
);
type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}
export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}
declare module '@atcute/lexicons/ambient' {
	interface Records {
		"social.popfeed.feed.like": mainSchema;
	}
}
