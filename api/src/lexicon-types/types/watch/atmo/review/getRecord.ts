import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as AppBskyActorProfile from "../../../app/bsky/actor/profile.js";
import * as SocialPopfeedActorProfile from "../../../social/popfeed/actor/profile.js";
import * as SocialPopfeedFeedComment from "../../../social/popfeed/feed/comment.js";
import * as SocialPopfeedFeedLike from "../../../social/popfeed/feed/like.js";
import * as SocialPopfeedFeedReview from "../../../social/popfeed/feed/review.js";

const _hydrateCommentsRecordSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.review.getRecord#hydrateCommentsRecord")),
		"cid": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.cidString()),
		"collection": /*#__PURE__*/ v.nsidString(),
		"did": /*#__PURE__*/ v.didString(),
		"rkey": /*#__PURE__*/ v.string(),
		"time_us": /*#__PURE__*/ v.integer(),
		"uri": /*#__PURE__*/ v.resourceUriString(),
		get "value"() {
			return SocialPopfeedFeedComment.mainSchema
		},
	}
);
const _hydrateLikesRecordSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.review.getRecord#hydrateLikesRecord")),
		"cid": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.cidString()),
		"collection": /*#__PURE__*/ v.nsidString(),
		"did": /*#__PURE__*/ v.didString(),
		"rkey": /*#__PURE__*/ v.string(),
		"time_us": /*#__PURE__*/ v.integer(),
		"uri": /*#__PURE__*/ v.resourceUriString(),
		get "value"() {
			return SocialPopfeedFeedLike.mainSchema
		},
	}
);
const _mainSchema = /*#__PURE__*/ v.query(
	"watch.atmo.review.getRecord",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * Number of comments records to embed
				 * @minimum 1
				 * @maximum 50
				 */
				"hydrateComments": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
					/*#__PURE__*/ v.integer(),
					[/*#__PURE__*/ v.integerRange(1, 50)]
				)),
				/**
				 * Number of likes records to embed
				 * @minimum 1
				 * @maximum 50
				 */
				"hydrateLikes": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
					/*#__PURE__*/ v.integer(),
					[/*#__PURE__*/ v.integerRange(1, 50)]
				)),
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
					get "comments"() {
						return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(hydrateCommentsRecordSchema))
					},
					/**
					 * Total comments count
					 */
					"commentsCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
					"did": /*#__PURE__*/ v.didString(),
					get "likes"() {
						return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(hydrateLikesRecordSchema))
					},
					/**
					 * Total likes count
					 */
					"likesCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
					get "profiles"() {
						return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(profileEntrySchema))
					},
					"rkey": /*#__PURE__*/ v.string(),
					"time_us": /*#__PURE__*/ v.integer(),
					"uri": /*#__PURE__*/ v.resourceUriString(),
					get "value"() {
						return SocialPopfeedFeedReview.mainSchema
					},
				}
			),
		}
	}
);
const _profileEntrySchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.review.getRecord#profileEntry")),
		"cid": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.cidString()),
		"collection": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.nsidString()),
		"did": /*#__PURE__*/ v.didString(),
		"handle": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		"rkey": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		"uri": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
		get "value"() {
			return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.variant([
				AppBskyActorProfile.mainSchema,
				SocialPopfeedActorProfile.mainSchema
			]))
		},
	}
);
type hydrateCommentsRecord$schematype = typeof _hydrateCommentsRecordSchema;
type hydrateLikesRecord$schematype = typeof _hydrateLikesRecordSchema;
type main$schematype = typeof _mainSchema;
type profileEntry$schematype = typeof _profileEntrySchema;

export interface hydrateCommentsRecordSchema extends hydrateCommentsRecord$schematype {}

export interface hydrateLikesRecordSchema extends hydrateLikesRecord$schematype {}

export interface mainSchema extends main$schematype {}

export interface profileEntrySchema extends profileEntry$schematype {}
export const hydrateCommentsRecordSchema = _hydrateCommentsRecordSchema as hydrateCommentsRecordSchema;
export const hydrateLikesRecordSchema = _hydrateLikesRecordSchema as hydrateLikesRecordSchema;
export const mainSchema = _mainSchema as mainSchema;
export const profileEntrySchema = _profileEntrySchema as profileEntrySchema;

export interface HydrateCommentsRecord extends v.InferInput<typeof hydrateCommentsRecordSchema> {}

export interface HydrateLikesRecord extends v.InferInput<typeof hydrateLikesRecordSchema> {}

export interface ProfileEntry extends v.InferInput<typeof profileEntrySchema> {}

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"watch.atmo.review.getRecord": mainSchema;
	}
}
