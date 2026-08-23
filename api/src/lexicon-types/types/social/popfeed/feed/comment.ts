import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as SocialPopfeedRichtextFacet from "../richtext/facet.js";

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("social.popfeed.feed.comment"),
			/**
			 * Client-declared timestamp when this comment was created.
			 */
			"createdAt": /*#__PURE__*/ v.datetimeString(),
			/**
			 * Annotations of text (mentions, URLs, hashtags, etc).
			 */
			get "facets"() {
				return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(SocialPopfeedRichtextFacet.mainSchema))
			},
			/**
			 * The URI of the root entity of the comment thread, if applicable.
			 */
			"rootUri": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
			/**
			 * The type of subject being commented on, e.g., 'review'.
			 */
			"subjectType": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literalEnum([
				"comment",
				"list",
				"post",
				"review"
			])),
			/**
			 * The URI of the review being commented on.
			 */
			"subjectUri": /*#__PURE__*/ v.genericUriString(),
			/**
			 * The primary comment content.
			 * @maxLength 1000
			 */
			"text": /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 1000)]
			),
		}
	)
);
type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}
export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}
declare module '@atcute/lexicons/ambient' {
	interface Records {
		"social.popfeed.feed.comment": mainSchema;
	}
}
