import { describe, expect, it } from 'vitest';
import { legalDocuments, legalFooterLinks, legalReviewNeeded, REPORT_EMAIL } from './legal';
import { match } from '../params/legal';

describe('Watch legal pages', () => {
	it('provides a constrained route for every linked document', () => {
		expect(Object.keys(legalDocuments)).toEqual(['terms', 'privacy', 'imprint']);
		for (const [name, document] of Object.entries(legalDocuments)) {
			expect(match(name)).toBe(true);
			expect(legalFooterLinks[name as keyof typeof legalDocuments]).toBe(`/${name}`);
			expect(document.sections.length).toBeGreaterThan(0);
			expect(new Set(document.sections.map((section) => section.id)).size).toBe(
				document.sections.length
			);
		}
		expect(match('movie')).toBe(false);
		expect(match('privacy-policy-not-found')).toBe(false);
	});

	it('keeps unreviewed policies as drafts without invented publication dates', () => {
		for (const document of Object.values(legalDocuments)) {
			expect(document.status).toBe('draft');
			expect(document.updated).toBeUndefined();
		}
		expect(legalReviewNeeded.join(' ')).toContain('postal address');
	});

	it('uses the requested report address throughout the policies and footer', () => {
		expect(REPORT_EMAIL).toBe('reports@atmo.social');
		expect(legalFooterLinks.report).toEqual({
			label: REPORT_EMAIL,
			href: `mailto:${REPORT_EMAIL}`
		});
		for (const document of Object.values(legalDocuments)) {
			expect(
				document.sections.some((section) =>
					section.links?.some((link) => link.href === `mailto:${REPORT_EMAIL}`)
				)
			).toBe(true);
		}
	});
});
