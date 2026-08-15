import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as AppBskyActorProfile from "../../../app/bsky/actor/profile.js";
import * as SocialPopfeedActorProfile from "../../../social/popfeed/actor/profile.js";
import * as SocialPopfeedFeedList from "../../../social/popfeed/feed/list.js";
import * as SocialPopfeedFeedListItem from "../../../social/popfeed/feed/listItem.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"watch.atmo.listItem.listRecords",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * Filter by an indexed DID or cached handle
				 */
				"actor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.actorIdentifierString()),
				/**
				 * Maximum value for addedAt
				 */
				"addedAtMax": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Minimum value for addedAt
				 */
				"addedAtMin": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Filter by creativeWorkType
				 */
				"creativeWorkType": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Embed the referenced list record
				 */
				"hydrateList": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
				/**
				 * Filter by identifiers.tmdbId
				 */
				"identifiersTmdbId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Filter by identifiers.tmdbTvSeriesId
				 */
				"identifiersTmdbTvSeriesId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
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
				 * Filter by listUri
				 */
				"listUri": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
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
				"sort": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string<"addedAt" | "creativeWorkType" | "identifiersTmdbId" | "identifiersTmdbTvSeriesId" | "listType" | "listUri" | "status" | (string & {})>()),
				/**
				 * Filter by status
				 */
				"status": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
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
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.listItem.listRecords#profileEntry")),
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
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.listItem.listRecords#record")),
		"cid": /*#__PURE__*/ v.cidString(),
		"collection": /*#__PURE__*/ v.nsidString(),
		"did": /*#__PURE__*/ v.didString(),
		get "list"() {
			return /*#__PURE__*/ v.optional(refListRecordSchema)
		},
		"rkey": /*#__PURE__*/ v.string(),
		"time_us": /*#__PURE__*/ v.integer(),
		"uri": /*#__PURE__*/ v.resourceUriString(),
		get "value"() {
			return SocialPopfeedFeedListItem.mainSchema
		},
	}
);
const _refListRecordSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.listItem.listRecords#refListRecord")),
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
type record$schematype = typeof _recordSchema;
type refListRecord$schematype = typeof _refListRecordSchema;

export interface mainSchema extends main$schematype {}

export interface profileEntrySchema extends profileEntry$schematype {}

export interface recordSchema extends record$schematype {}

export interface refListRecordSchema extends refListRecord$schematype {}
export const mainSchema = _mainSchema as mainSchema;
export const profileEntrySchema = _profileEntrySchema as profileEntrySchema;
export const recordSchema = _recordSchema as recordSchema;
export const refListRecordSchema = _refListRecordSchema as refListRecordSchema;

export interface ProfileEntry extends v.InferInput<typeof profileEntrySchema> {}

export interface Record extends v.InferInput<typeof recordSchema> {}

export interface RefListRecord extends v.InferInput<typeof refListRecordSchema> {}

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"watch.atmo.listItem.listRecords": mainSchema;
	}
}
