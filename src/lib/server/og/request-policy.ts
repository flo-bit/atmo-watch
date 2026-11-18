// Cost control, not authentication: user agents can be spoofed. Unidentified
// clients may still generate, but only within the unreserved part of the budget.
const BULK_CATEGORIES = new Set([
	'AI Crawler',
	'AI Assistant',
	'Search Engine Crawler',
	'Archiver'
]);

const SOCIAL_PREVIEW =
	/\b(?:Twitterbot|facebookexternalhit|Facebot|LinkedInBot|Slackbot(?:-LinkExpanding)?|Discordbot|TelegramBot|WhatsApp|SkypeUriPreview|Bluesky|Cardyb|Mastodon|Pleroma|Akkoma|Misskey|GoToSocial|Iframely|Embedly)\b/i;
const BULK_CRAWLER =
	/bot\b|crawl|spider|scrapy|GoogleOther|BingPreview|ChatGPT-User|Claude-User|Perplexity-User|python-requests|python-urllib/i;

/** Link unfurlers get the reserved share of the daily budget. */
export function isSocialPreview(request: Request): boolean {
	return SOCIAL_PREVIEW.test(request.headers.get('user-agent') ?? '');
}

/** Apply only on storage misses; stored images stay available to crawlers. */
export function canGenerateForRequest(request: Request): boolean {
	if (isSocialPreview(request)) return true;
	const cf = (request as Request & { cf?: { verifiedBotCategory?: string } }).cf;
	if (cf?.verifiedBotCategory && BULK_CATEGORIES.has(cf.verifiedBotCategory)) return false;
	return !BULK_CRAWLER.test(request.headers.get('user-agent') ?? '');
}
