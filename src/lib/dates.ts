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

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en', {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	timeZone: 'UTC',
	timeZoneName: 'short'
});

const RELATIVE_DATE_TIME_FORMATTER = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

const SECOND_IN_MILLISECONDS = 1000;
const MINUTE_IN_MILLISECONDS = 60 * SECOND_IN_MILLISECONDS;
const HOUR_IN_MILLISECONDS = 60 * MINUTE_IN_MILLISECONDS;
const DAY_IN_MILLISECONDS = 24 * HOUR_IN_MILLISECONDS;
const WEEK_IN_MILLISECONDS = 7 * DAY_IN_MILLISECONDS;
const MONTH_IN_MILLISECONDS = 30 * DAY_IN_MILLISECONDS;
const YEAR_IN_MILLISECONDS = 365 * DAY_IN_MILLISECONDS;

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

export function formatDateTime(value: string | null | undefined) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : DATE_TIME_FORMATTER.format(date);
}

export function formatRelativeDateTime(value: string | null | undefined, now: number = Date.now()) {
	if (!value) return null;
	const timestamp = Date.parse(value);
	if (Number.isNaN(timestamp) || !Number.isFinite(now)) return null;

	const difference = timestamp - now;
	const absoluteDifference = Math.abs(difference);
	if (absoluteDifference < MINUTE_IN_MILLISECONDS) return 'just now';

	let unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
	let duration: number;
	if (absoluteDifference < HOUR_IN_MILLISECONDS) {
		unit = 'minute';
		duration = MINUTE_IN_MILLISECONDS;
	} else if (absoluteDifference < DAY_IN_MILLISECONDS) {
		unit = 'hour';
		duration = HOUR_IN_MILLISECONDS;
	} else if (absoluteDifference < WEEK_IN_MILLISECONDS) {
		unit = 'day';
		duration = DAY_IN_MILLISECONDS;
	} else if (absoluteDifference < MONTH_IN_MILLISECONDS) {
		unit = 'week';
		duration = WEEK_IN_MILLISECONDS;
	} else if (absoluteDifference < YEAR_IN_MILLISECONDS) {
		unit = 'month';
		duration = MONTH_IN_MILLISECONDS;
	} else {
		unit = 'year';
		duration = YEAR_IN_MILLISECONDS;
	}

	const amount = Math.floor(absoluteDifference / duration) * Math.sign(difference);
	return RELATIVE_DATE_TIME_FORMATTER.format(amount, unit);
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
