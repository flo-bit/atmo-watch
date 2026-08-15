import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as AppBskyActorProfile from "../../../app/bsky/actor/profile.js";
import * as SocialPopfeedActorProfile from "../../../social/popfeed/actor/profile.js";
import * as SocialPopfeedFeedList from "../../../social/popfeed/feed/list.js";
import * as SocialPopfeedFeedListItem from "../../../social/popfeed/feed/listItem.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"watch.atmo.listItem.getRecord",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * Embed the referenced list record
				 */
				"hydrateList": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
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
					get "list"() {
						return /*#__PURE__*/ v.optional(refListRecordSchema)
					},
					get "profiles"() {
						return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(profileEntrySchema))
					},
					"rkey": /*#__PURE__*/ v.string(),
					"time_us": /*#__PURE__*/ v.integer(),
					"uri": /*#__PURE__*/ v.resourceUriString(),
					get "value"() {
						return SocialPopfeedFeedListItem.mainSchema
					},
				}
			),
		}
	}
);
const _profileEntrySchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.listItem.getRecord#profileEntry")),
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
const _refListRecordSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.listItem.getRecord#refListRecord")),
		"cid": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.cidString()),
		"collection": /*#__PURE__*/ v.nsidString(),
		"did": /*#__PURE__*/ v.didString(),
		"rkey": /*#__PURE__*/ v.string(),
		"time_us": /*#__PURE__*/ v.integer(),
		"uri": /*#__PURE__*/ v.resourceUriString(),
		get "value"() {
			return SocialPopfeedFeedList.mainSchema
		},
	}
);
type main$schematype = typeof _mainSchema;
type profileEntry$schematype = typeof _profileEntrySchema;
type refListRecord$schematype = typeof _refListRecordSchema;

export interface mainSchema extends main$schematype {}

export interface profileEntrySchema extends profileEntry$schematype {}

export interface refListRecordSchema extends refListRecord$schematype {}
export const mainSchema = _mainSchema as mainSchema;
export const profileEntrySchema = _profileEntrySchema as profileEntrySchema;
export const refListRecordSchema = _refListRecordSchema as refListRecordSchema;

export interface ProfileEntry extends v.InferInput<typeof profileEntrySchema> {}

export interface RefListRecord extends v.InferInput<typeof refListRecordSchema> {}

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"watch.atmo.listItem.getRecord": mainSchema;
	}
}
