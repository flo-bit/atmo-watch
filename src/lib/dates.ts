const FULL_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
	weekday: 'long',
	year: 'numeric',
	month: 'long',
	day: 'numeric',
	timeZone: 'UTC'
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function parseCalendarDate(value: string | null | undefined) {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCalendarDate(
	value: string | null | undefined,
	style: 'full' | 'short' = 'full'
) {
	const date = parseCalendarDate(value);
	if (!date) return null;
	return (style === 'full' ? FULL_DATE_FORMATTER : SHORT_DATE_FORMATTER).format(date);
}

export function calendarDayDifference(
	value: string | null | undefined,
	today: string | null | undefined
) {
	const date = parseCalendarDate(value);
	const currentDate = parseCalendarDate(today);
	if (!date || !currentDate) return null;
	return Math.round((date.getTime() - currentDate.getTime()) / DAY_IN_MILLISECONDS);
}

export function relativeCalendarDate(
	value: string | null | undefined,
	today: string | null | undefined
) {
	const difference = calendarDayDifference(value, today);
	if (difference === null) return null;
	if (difference === 0) return 'today';
	if (difference === 1) return 'tomorrow';
	if (difference === -1) return 'yesterday';
	if (difference > 1) return `in ${difference} days`;
	return `${Math.abs(difference)} days ago`;
}
