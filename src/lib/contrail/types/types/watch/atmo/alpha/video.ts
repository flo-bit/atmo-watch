import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _identifiersSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("watch.atmo.alpha.video#identifiers")),
		/**
		 * Episode number when targeting an episode.
		 * @minimum 0
		 */
		"episodeNumber": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		/**
		 * Season number when targeting a season or episode.
		 * @minimum 0
		 */
		"seasonNumber": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		/**
		 * TMDB ID of the exact movie, show, season, or episode.
		 */
		"tmdbId": /*#__PURE__*/ v.string(),
		/**
		 * TMDB ID of the containing TV series.
		 */
		"tmdbTvSeriesId": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
	}
);
const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("watch.atmo.alpha.video"),
			/**
			 * Name of the YouTube channel when the video was submitted.
			 * @maxLength 500
			 */
			"channelName": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 500)]
			)),
			/**
			 * URL of the YouTube channel when the video was submitted.
			 * @maxLength 2048
			 */
			"channelUrl": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.genericUriString(),
				[/*#__PURE__*/ v.stringLength(0, 2048)]
			)),
			/**
			 * Whether the video may contain spoilers.
			 */
			"containsSpoilers": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
			"createdAt": /*#__PURE__*/ v.datetimeString(),
			/**
			 * The specificity of the creative work associated with this video.
			 */
			"creativeWorkType": /*#__PURE__*/ v.literalEnum([
				"movie",
				"tv_episode",
				"tv_season",
				"tv_show"
			]),
			get "identifiers"() {
				return identifiersSchema
			},
			/**
			 * Thumbnail URL returned by YouTube when the video was submitted.
			 * @maxLength 2048
			 */
			"thumbnailUrl": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.genericUriString(),
				[/*#__PURE__*/ v.stringLength(0, 2048)]
			)),
			/**
			 * Title of the associated movie, show, season, or episode.
			 * @maxLength 1000
			 */
			"title": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 1000)]
			)),
			/**
			 * Title returned by YouTube when the video was submitted.
			 * @maxLength 500
			 */
			"videoTitle": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 500)]
			)),
			/**
			 * The kind of video being submitted.
			 */
			"videoType": /*#__PURE__*/ v.string<"analysis" | "behind_the_scenes" | "blooper" | "clip" | "deleted_scene" | "fan_edit" | "featurette" | "interview" | "other" | "reaction" | "recap" | "review" | "scene" | "supercut" | "teaser" | "trailer" | (string & {})>(),
			/**
			 * Canonical YouTube URL for the submitted video.
			 * @maxLength 2048
			 */
			"videoUrl": /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.genericUriString(),
				[/*#__PURE__*/ v.stringLength(0, 2048)]
			),
			/**
			 * YouTube video ID parsed from videoUrl.
			 * @minLength 1
			 * @maxLength 64
			 */
			"youtubeId": /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(1, 64)]
			),
		}
	)
);
type identifiers$schematype = typeof _identifiersSchema;
type main$schematype = typeof _mainSchema;

export interface identifiersSchema extends identifiers$schematype {}

export interface mainSchema extends main$schematype {}
export const identifiersSchema = _identifiersSchema as identifiersSchema;
export const mainSchema = _mainSchema as mainSchema;

export interface Identifiers extends v.InferInput<typeof identifiersSchema> {}

export interface Main extends v.InferInput<typeof mainSchema> {}
declare module '@atcute/lexicons/ambient' {
	interface Records {
		"watch.atmo.alpha.video": mainSchema;
	}
}
