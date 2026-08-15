import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as SocialPopfeedRichtextFacet from "../richtext/facet.js";

const _crossPostsSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("social.popfeed.feed.review#crossPosts")),
		/**
		 * The URI of the original Bluesky post being cross-posted.
		 */
		"bluesky": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
		/**
		 * The URI of the original Leaflet post being cross-posted.
		 */
		"leaflet": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
	}
);
const _identifiersSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("social.popfeed.feed.review#identifiers")),
		"asin": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		/**
		 * Episode number for TV shows or series
		 */
		"episodeNumber": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		"igdbId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		"imdbId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		"isbn10": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		"isbn13": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		/**
		 * DEPRECATED - soon to be ignored
		 */
		"mbId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		/**
		 * MusicBrainz ID for specific releases (albums, EPs, tracks)
		 */
		"mbReleaseId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		"other": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		/**
		 * MusicBrainz ID for parent release (e.g., album for a track)
		 */
		"parentMbReleaseId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		/**
		 * Season number for TV shows or series
		 */
		"seasonNumber": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		"tmdbId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		/**
		 * TMDb ID for TV series
		 */
		"tmdbTvSeriesId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
	}
);
const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("social.popfeed.feed.review"),
			/**
			 * Backdrop image for the review post. Have not fully cut over yet so may not be shown
			 * @accept image/*
			 * @maxSize 4000000
			 */
			"backdrop": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.blob(),
				[
					/*#__PURE__*/ v.blobSize(4000000),
					/*#__PURE__*/ v.blobAccept(["image/*"])
				]
			)),
			/**
			 * Backdrop image URL for the creative work. Soon to be deprecated in favor of the 'backdrop' blob field
			 */
			"backdropUrl": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
			/**
			 * Indicates if the review contains spoilers.
			 */
			"containsSpoilers": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
			"createdAt": /*#__PURE__*/ v.datetimeString(),
			"creativeWorkType": /*#__PURE__*/ v.literalEnum([
				"album",
				"album",
				"book",
				"book_series",
				"ep",
				"episode",
				"movie",
				"track",
				"tv_episode",
				"tv_season",
				"tv_show",
				"video_game"
			]),
			/**
			 * Information about cross-posting to other platforms.
			 */
			get "crossPosts"() {
				return /*#__PURE__*/ v.optional(crossPostsSchema)
			},
			/**
			 * Annotations of text (mentions, URLs, hashtags, etc)
			 */
			get "facets"() {
				return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(SocialPopfeedRichtextFacet.mainSchema))
			},
			"genres": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 50)]
			))),
			get "identifiers"() {
				return identifiersSchema
			},
			/**
			 * Indicates if the user has experienced this work before (re-watch, re-read, replay).
			 */
			"isRevisit": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
			/**
			 * Main actor, director, author, or artist of the creative work.
			 * @maxLength 1000
			 */
			"mainCredit": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 1000)]
			)),
			/**
			 * The role of the main credit.
			 */
			"mainCreditRole": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literalEnum([
				"artist",
				"author",
				"creator",
				"developer",
				"director",
				"lead_actor",
				"network",
				"performer",
				"publisher",
				"showrunner",
				"studio"
			])),
			/**
			 * @accept image/*
			 * @maxSize 2000000
			 */
			"poster": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.blob(),
				[
					/*#__PURE__*/ v.blobSize(2000000),
					/*#__PURE__*/ v.blobAccept(["image/*"])
				]
			)),
			/**
			 * Poster or cover image URL for the creative work. Soon to be deprecated in favor of the 'poster' blob field
			 */
			"posterUrl": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
			/**
			 * @minimum 0
			 * @maximum 10
			 */
			"rating": /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.integer(),
				[/*#__PURE__*/ v.integerRange(0, 10)]
			),
			/**
			 * Release date of the creative work.
			 */
			"releaseDate": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
			"tags": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 50)]
			))),
			/**
			 * @maxLength 100000
			 */
			"text": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 100000)]
			)),
			/**
			 * Title of the creative work.
			 * @maxLength 1000
			 */
			"title": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 1000)]
			)),
		}
	)
);
type crossPosts$schematype = typeof _crossPostsSchema;
type identifiers$schematype = typeof _identifiersSchema;
type main$schematype = typeof _mainSchema;

export interface crossPostsSchema extends crossPosts$schematype {}

export interface identifiersSchema extends identifiers$schematype {}

export interface mainSchema extends main$schematype {}
export const crossPostsSchema = _crossPostsSchema as crossPostsSchema;
export const identifiersSchema = _identifiersSchema as identifiersSchema;
export const mainSchema = _mainSchema as mainSchema;

export interface CrossPosts extends v.InferInput<typeof crossPostsSchema> {}

export interface Identifiers extends v.InferInput<typeof identifiersSchema> {}

export interface Main extends v.InferInput<typeof mainSchema> {}
declare module '@atcute/lexicons/ambient' {
	interface Records {
		"social.popfeed.feed.review": mainSchema;
	}
}
