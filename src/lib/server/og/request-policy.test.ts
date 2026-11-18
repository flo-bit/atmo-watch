import { describe, expect, it } from 'vitest';
import { canGenerateForRequest, isSocialPreview } from './request-policy';

function request(userAgent: string, verifiedBotCategory?: string) {
	const result = new Request('https://atmo.test/movie/1/og.jpg', {
		headers: { 'User-Agent': userAgent }
	});
	if (verifiedBotCategory) Object.assign(result, { cf: { verifiedBotCategory } });
	return result;
}

describe('OG generation request policy', () => {
	it.each([
		'Mozilla/5.0 (compatible; GPTBot/1.4; +https://openai.com/gptbot)',
		'Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +searchbot@anthropic.com)',
		'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
		'Mozilla/5.0 (compatible; ElevenlabsCrawler/1.0; +https://elevenlabs.io/docs/bots)',
		'Googlebot-Image/1.0',
		'python-requests/2.32'
	])('does not let bulk crawler %s generate', (userAgent) => {
		expect(canGenerateForRequest(request(userAgent))).toBe(false);
		expect(isSocialPreview(request(userAgent))).toBe(false);
	});

	it.each([
		'Mozilla/5.0 (compatible; Bluesky Cardyb/1.1; +mailto:support@bsky.app)',
		'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
		'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
		'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
		'Twitterbot/1.0'
	])('lets link unfurler %s generate from the reserve', (userAgent) => {
		expect(canGenerateForRequest(request(userAgent))).toBe(true);
		expect(isSocialPreview(request(userAgent))).toBe(true);
	});

	it('lets browsers generate, without access to the reserve', () => {
		const browser = request('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/145.0.0.0');
		expect(canGenerateForRequest(browser)).toBe(true);
		expect(isSocialPreview(browser)).toBe(false);
	});

	it("uses Cloudflare's verified category even when the user agent looks like a browser", () => {
		expect(canGenerateForRequest(request('Mozilla/5.0 Chrome/145.0.0.0', 'AI Crawler'))).toBe(
			false
		);
	});
});
