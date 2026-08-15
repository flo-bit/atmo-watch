import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as SocialPopfeedFeedComment from "../../../social/popfeed/feed/comment.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"watch.atmo.comment.getRecord",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * Include indexed profile and identity information
				 */
				"profiles": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
				/**
				 * AT URI of the record
				 */
				"uri": /*#__PURE__*/ v.resourceUriString(),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					"cid": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.cidString()),
					"collection": /*#__PURE__*/ v.nsidString(),
					"did": /*#__PURE__*/ v.didString(),
					get "profiles"() {
						return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(profileEntrySchema))
					},
					"rkey": /*#__PURE__*/ v.string(),
					"time_us": /*#__PURE__*/ v.integer(),
					"uri": /*#__PURE__*/ v.resourceUriString(),
					get "value"() {
						return SocialPopfeedFeedComment.mainSchema
					},
				}
			),
		}
	}
);
const _profileEntrySchema = /*#__PURE__*/ v.object({
	"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.comment.getRecord#profileEntry")),
	"cid": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.cidString()),
	"collection": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.nsidString()),
	"did": /*#__PURE__*/ v.didString(),
	"handle": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
	"rkey": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
	"uri": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
	"value": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.unknown()),
});
type main$schematype = typeof _mainSchema;
type profileEntry$schematype = typeof _profileEntrySchema;

export interface mainSchema extends main$schematype {}

export interface profileEntrySchema extends profileEntry$schematype {}
export const mainSchema = _mainSchema as mainSchema;
export const profileEntrySchema = _profileEntrySchema as profileEntrySchema;

export interface ProfileEntry extends v.InferInput<typeof profileEntrySchema> {}

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"watch.atmo.comment.getRecord": mainSchema;
	}
}
