import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as AppBskyActorProfile from "../../../app/bsky/actor/profile.js";
import * as SocialPopfeedActorProfile from "../../../social/popfeed/actor/profile.js";
import * as WatchAtmoAlphaVideo from "../alpha/video.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"watch.atmo.video.listRecords",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * Filter by an indexed DID or cached handle
				 */
				"actor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.actorIdentifierString()),
				/**
				 * Maximum value for createdAt
				 */
				"createdAtMax": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Minimum value for createdAt
				 */
				"createdAtMin": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Filter by creativeWorkType
				 */
				"creativeWorkType": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Filter by identifiers.episodeNumber
				 */
				"identifiersEpisodeNumber": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Filter by identifiers.seasonNumber
				 */
				"identifiersSeasonNumber": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
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
				"sort": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string<"createdAt" | "creativeWorkType" | "identifiersEpisodeNumber" | "identifiersSeasonNumber" | "identifiersTmdbId" | "identifiersTmdbTvSeriesId" | "videoType" | "youtubeId" | (string & {})>()),
				/**
				 * Filter by videoType
				 */
				"videoType": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Filter by youtubeId
				 */
				"youtubeId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
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
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.video.listRecords#profileEntry")),
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
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.video.listRecords#record")),
		"cid": /*#__PURE__*/ v.cidString(),
		"collection": /*#__PURE__*/ v.nsidString(),
		"did": /*#__PURE__*/ v.didString(),
		"rkey": /*#__PURE__*/ v.string(),
		"time_us": /*#__PURE__*/ v.integer(),
		"uri": /*#__PURE__*/ v.resourceUriString(),
		get "value"() {
			return WatchAtmoAlphaVideo.mainSchema
		},
	}
);
type main$schematype = typeof _mainSchema;
type profileEntry$schematype = typeof _profileEntrySchema;
type record$schematype = typeof _recordSchema;

export interface mainSchema extends main$schematype {}

export interface profileEntrySchema extends profileEntry$schematype {}

export interface recordSchema extends record$schematype {}
export const mainSchema = _mainSchema as mainSchema;
export const profileEntrySchema = _profileEntrySchema as profileEntrySchema;
export const recordSchema = _recordSchema as recordSchema;

export interface ProfileEntry extends v.InferInput<typeof profileEntrySchema> {}

export interface Record extends v.InferInput<typeof recordSchema> {}

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"watch.atmo.video.listRecords": mainSchema;
	}
}
