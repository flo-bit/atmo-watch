import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as AppBskyActorProfile from "../../../app/bsky/actor/profile.js";
import * as SocialPopfeedActorProfile from "../../../social/popfeed/actor/profile.js";
import * as SocialPopfeedFeedComment from "../../../social/popfeed/feed/comment.js";
import * as SocialPopfeedFeedLike from "../../../social/popfeed/feed/like.js";
import * as SocialPopfeedFeedList from "../../../social/popfeed/feed/list.js";
import * as SocialPopfeedFeedListItem from "../../../social/popfeed/feed/listItem.js";

const _hydrateCommentsRecordSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.list.listRecords#hydrateCommentsRecord")),
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
const _hydrateItemsRecordSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.list.listRecords#hydrateItemsRecord")),
		"cid": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.cidString()),
		"collection": /*#__PURE__*/ v.nsidString(),
		"did": /*#__PURE__*/ v.didString(),
		"rkey": /*#__PURE__*/ v.string(),
		"time_us": /*#__PURE__*/ v.integer(),
		"uri": /*#__PURE__*/ v.resourceUriString(),
		get "value"() {
			return SocialPopfeedFeedListItem.mainSchema
		},
	}
);
const _hydrateLikesRecordSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.list.listRecords#hydrateLikesRecord")),
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
	"watch.atmo.list.listRecords",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * Filter by an indexed DID or cached handle
				 */
				"actor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.actorIdentifierString()),
				/**
				 * Minimum total comments count
				 */
				"commentsCountMin": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
				/**
				 * Maximum value for createdAt
				 */
				"createdAtMax": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Minimum value for createdAt
				 */
				"createdAtMin": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
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
				 * Number of items records to embed
				 * @minimum 1
				 * @maximum 50
				 */
				"hydrateItems": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
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
				 * Minimum total items count
				 */
				"itemsCountMin": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
				/**
				 * Minimum total likes count
				 */
				"likesCountMin": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
				/**
				 * @minimum 1
				 * @maximum 200
				 * @default 50
				 */
				"limit": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1, 200)]
					),
					50
				),
				/**
				 * Filter by listType
				 */
				"listType": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Sort direction
				 */
				"order": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string<"asc" | "desc" | (string & {})>()),
				/**
				 * Include indexed profile and identity information
				 */
				"profiles": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
				/**
				 * Field to sort by (default: time_us)
				 */
				"sort": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string<"commentsCount" | "createdAt" | "itemsCount" | "likesCount" | "listType" | (string & {})>()),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
					get "profiles"() {
						return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(profileEntrySchema))
					},
					get "records"() {
						return /*#__PURE__*/ v.array(recordSchema)
					},
				}
			),
		}
	}
);
const _profileEntrySchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.list.listRecords#profileEntry")),
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
const _recordSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.list.listRecords#record")),
		"cid": /*#__PURE__*/ v.cidString(),
		"collection": /*#__PURE__*/ v.nsidString(),
		get "comments"() {
			return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(hydrateCommentsRecordSchema))
		},
		/**
		 * Total comments count
		 */
		"commentsCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		"did": /*#__PURE__*/ v.didString(),
		get "items"() {
			return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(hydrateItemsRecordSchema))
		},
		/**
		 * Total items count
		 */
		"itemsCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		get "likes"() {
			return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(hydrateLikesRecordSchema))
		},
		/**
		 * Total likes count
		 */
		"likesCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		"rkey": /*#__PURE__*/ v.string(),
		"time_us": /*#__PURE__*/ v.integer(),
		"uri": /*#__PURE__*/ v.resourceUriString(),
		get "value"() {
			return SocialPopfeedFeedList.mainSchema
		},
	}
);
type hydrateCommentsRecord$schematype = typeof _hydrateCommentsRecordSchema;
type hydrateItemsRecord$schematype = typeof _hydrateItemsRecordSchema;
type hydrateLikesRecord$schematype = typeof _hydrateLikesRecordSchema;
type main$schematype = typeof _mainSchema;
type profileEntry$schematype = typeof _profileEntrySchema;
type record$schematype = typeof _recordSchema;

export interface hydrateCommentsRecordSchema extends hydrateCommentsRecord$schematype {}

export interface hydrateItemsRecordSchema extends hydrateItemsRecord$schematype {}

export interface hydrateLikesRecordSchema extends hydrateLikesRecord$schematype {}

export interface mainSchema extends main$schematype {}

export interface profileEntrySchema extends profileEntry$schematype {}

export interface recordSchema extends record$schematype {}
export const hydrateCommentsRecordSchema = _hydrateCommentsRecordSchema as hydrateCommentsRecordSchema;
export const hydrateItemsRecordSchema = _hydrateItemsRecordSchema as hydrateItemsRecordSchema;
export const hydrateLikesRecordSchema = _hydrateLikesRecordSchema as hydrateLikesRecordSchema;
export const mainSchema = _mainSchema as mainSchema;
export const profileEntrySchema = _profileEntrySchema as profileEntrySchema;
export const recordSchema = _recordSchema as recordSchema;

export interface HydrateCommentsRecord extends v.InferInput<typeof hydrateCommentsRecordSchema> {}

export interface HydrateItemsRecord extends v.InferInput<typeof hydrateItemsRecordSchema> {}

export interface HydrateLikesRecord extends v.InferInput<typeof hydrateLikesRecordSchema> {}

export interface ProfileEntry extends v.InferInput<typeof profileEntrySchema> {}

export interface Record extends v.InferInput<typeof recordSchema> {}

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"watch.atmo.list.listRecords": mainSchema;
	}
}
