import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _externalLinkSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("social.popfeed.actor.profile#externalLink")),
		/**
		 * Name of the external service (e.g., 'Twitter', 'GitHub').
		 * @maxLength 100
		 */
		"service": /*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[/*#__PURE__*/ v.stringLength(0, 100)]
		),
		/**
		 * URL to the user's profile on the external service.
		 */
		"url": /*#__PURE__*/ v.genericUriString(),
	}
);
const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.literal("self"),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("social.popfeed.actor.profile"),
			/**
			 * Larger horizontal image to display behind profile view. Have not fully cut over yet so may not be shown
			 * @accept image/png, image/jpeg
			 * @maxSize 1000000
			 */
			"banner": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.blob(),
				[
					/*#__PURE__*/ v.blobSize(1000000),
					/*#__PURE__*/ v.blobAccept(["image/png", "image/jpeg"])
				]
			)),
			/**
			 * Optional URL to a banner image. DEPRECATED - soon to be ignored
			 */
			"bannerUrl": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
			"createdAt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
			/**
			 * Free-form profile description text.
			 * @maxLength 2560
			 * @maxGraphemes 256
			 */
			"description": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[
					/*#__PURE__*/ v.stringLength(0, 2560),
					/*#__PURE__*/ v.stringGraphemes(0, 256)
				]
			)),
			/**
			 * @maxLength 640
			 * @maxGraphemes 64
			 */
			"displayName": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[
					/*#__PURE__*/ v.stringLength(0, 640),
					/*#__PURE__*/ v.stringGraphemes(0, 64)
				]
			)),
			/**
			 * List of external links to the user's profiles on other services.
			 */
			get "externalLinks"() {
				return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(externalLinkSchema))
			},
		}
	)
);
type externalLink$schematype = typeof _externalLinkSchema;
type main$schematype = typeof _mainSchema;

export interface externalLinkSchema extends externalLink$schematype {}

export interface mainSchema extends main$schematype {}
export const externalLinkSchema = _externalLinkSchema as externalLinkSchema;
export const mainSchema = _mainSchema as mainSchema;

export interface ExternalLink extends v.InferInput<typeof externalLinkSchema> {}

export interface Main extends v.InferInput<typeof mainSchema> {}
declare module '@atcute/lexicons/ambient' {
	interface Records {
		"social.popfeed.actor.profile": mainSchema;
	}
}
