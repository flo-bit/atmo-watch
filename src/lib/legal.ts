import type { LegalDocumentData, LegalFooterLinks } from '@atmo-dev/kit/legal';

export const REPORT_EMAIL = 'reports@atmo.social';
const contact = [{ label: REPORT_EMAIL, href: `mailto:${REPORT_EMAIL}` }];

// App-owned drafts, not runtime-generated policy text. Review before publication;
// in particular, the imprint still needs the operator's full postal address.
export const legalDocuments: Record<'terms' | 'privacy' | 'imprint', LegalDocumentData> = {
	terms: {
		title: 'Terms of service',
		status: 'draft',
		sections: [
			{
				id: 'service',
				title: 'Using atmo.watch',
				paragraphs: [
					'atmo.watch is a movie and TV discovery, rating, review, and list app built on the AT Protocol. You can browse without an account. Publishing reviews, comments, likes, lists, watched status, or video links requires signing in with an Atmosphere account.'
				]
			},
			{
				id: 'public-content',
				title: 'Your content',
				paragraphs: [
					'You retain your rights to content you create. Only publish content you have the right to share. Your contributions are stored as public records with your account provider and may be indexed, displayed, or retained by other services on the AT Protocol.',
					'Deleting or changing a record may take time to appear in this app. We cannot remove copies held by independent services. Reviews and lists are not private storage.'
				]
			},
			{
				id: 'conduct',
				title: 'Community rules',
				items: [
					'Do not post illegal content or violate copyright, privacy, or other rights.',
					'Do not harass, threaten, impersonate deceptively, or promote violence.',
					'Do not use the service for spam, scams, phishing, malware, or abuse of its infrastructure.'
				]
			},
			{
				id: 'reporting',
				title: 'Reports and restrictions',
				paragraphs: [
					'To report content or a problem, email the relevant link and explain your concern. You do not need an account to report by email. Do not attach or redistribute illegal imagery.',
					'We may restrict access to this app or remove content from its display to address abuse or legal obligations. This does not delete records from their account provider or other apps. Contact us if you believe a restriction is mistaken.'
				],
				links: contact
			},
			{
				id: 'third-parties',
				title: 'External services',
				paragraphs: [
					'Catalog information, artwork, ratings, streaming availability, and embedded videos come from third parties and may be incomplete or inaccurate. External services have their own terms and privacy policies. atmo.watch is not endorsed or certified by TMDB.'
				]
			},
			{
				id: 'availability',
				title: 'Availability and changes',
				paragraphs: [
					'The service may change or be interrupted. We do not promise uninterrupted availability or the accuracy of catalog information or user contributions. Nothing in these terms limits rights or liability that cannot lawfully be limited. Changes to these terms will be reflected on this page.'
				]
			}
		]
	},
	privacy: {
		title: 'Privacy policy',
		status: 'draft',
		sections: [
			{
				id: 'contact',
				title: 'Who operates this app',
				paragraphs: [
					'atmo.watch is operated by Florian Killius. Contact us about privacy, access, correction, or deletion requests using the email below.'
				],
				links: contact
			},
			{
				id: 'authentication',
				title: 'Signing in',
				paragraphs: [
					'We use AT Protocol OAuth to authenticate your account. Your account provider handles sign-in; we do not receive your password. We store your account identifier and session tokens to keep you signed in and perform the actions you request. OAuth session and temporary sign-in state are stored using Cloudflare KV.'
				]
			},
			{
				id: 'public-records',
				title: 'Public account data and contributions',
				paragraphs: [
					'We read and index public profiles, ratings, reviews, comments, likes, lists, list entries, and submitted video links to display and find content. Your contributions, including watched-list entries, are public records with your account provider, not private account settings.',
					'The app uses a separate indexing service and caches public data and share images. Updates and deletions may not appear immediately. Other AT Protocol services can keep their own copies; deleting data here or with your account provider cannot remove those copies.'
				]
			},
			{
				id: 'device-storage',
				title: 'Cookies and browser storage',
				paragraphs: [
					'We use cookies for authentication. The login form also uses browser storage to remember recent accounts on your device. You can remove recent accounts in the login form or clear your browser storage. Signing out ends your session in this app.'
				]
			},
			{
				id: 'hosting',
				title: 'Hosting and request data',
				paragraphs: [
					'Cloudflare hosts the app, its indexing API, and cached data. Delivering and securing the service can involve processing request metadata such as IP addresses. Your request country is used to choose regional streaming availability.'
				]
			},
			{
				id: 'external-services',
				title: 'Catalog, images, and videos',
				paragraphs: [
					'Movie and TV information is requested from TMDB; additional ratings come from OMDb. Catalog searches are sent through this app to the catalog provider. Images can load from TMDB, AT Protocol image services, or other image providers and may disclose your IP address to those providers.',
					'Playing a trailer or submitted video loads a YouTube player, including youtube-nocookie.com embeds. YouTube then receives request information and applies its own policies. Following links to external sites also connects you to those services.'
				]
			},
			{
				id: 'reports',
				title: 'Email reports',
				paragraphs: [
					'If you email us, your email address, message, and any content links you provide are used to handle your request. Do not include information that is unnecessary for the report. Contact us at the same address about the handling or deletion of correspondence.'
				],
				links: contact
			}
		]
	},
	imprint: {
		title: 'Imprint',
		status: 'draft',
		sections: [
			{ id: 'operator', title: 'Operator', address: ['Florian Killius'], links: contact },
			{
				id: 'contact',
				title: 'Contact and reports',
				paragraphs: [
					'For questions about atmo.watch, privacy requests, or reports, email us with the relevant page or content link.'
				],
				links: contact
			},
			{
				id: 'source',
				title: 'Source code',
				links: [{ label: 'atmo.watch on GitHub', href: 'https://github.com/flo-bit/atmo-watch' }]
			}
		]
	}
};

export type LegalPage = keyof typeof legalDocuments;

export const legalFooterLinks: LegalFooterLinks = {
	terms: '/terms',
	privacy: '/privacy',
	imprint: '/imprint',
	report: { label: REPORT_EMAIL, href: `mailto:${REPORT_EMAIL}` },
	source: { label: 'Source', href: 'https://github.com/flo-bit/atmo-watch' }
};

// These are drafts, not a determination of legal compliance or legal advice.
export const legalReviewNeeded = [
	'Confirm operator details and add a full postal address to the imprint.',
	'Review applicable legal bases, recipients/processors, international transfers and safeguards.',
	'Confirm retention and deletion periods for sessions, indexed records, caches, logs, backups and email.',
	'Review third-party embeds, browser storage, consent requirements, audience and statutory rights.',
	'Confirm reporting and appeal procedures; review the documents before setting status to published and adding a revision date.'
] as const;
