export interface OgBudgetEnv {
	DB: D1Database;
	OG_DAILY_GENERATION_LIMIT?: string;
	OG_DAILY_SOCIAL_RESERVE?: string;
	OG_CYCLE_GENERATION_LIMIT?: string;
	OG_BILLING_CYCLE_START_DAY?: string;
}

// Longer than a render. Failed generations keep the lease as a cooldown;
// successful ones release it after the R2 PUT.
export const LEASE_MS = 10 * 60 * 1000;

/** Created on first use, so a rebuilt database does not silently disable images. */
export const OG_SCHEMA = [
	`CREATE TABLE IF NOT EXISTS og_generation_budget (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		day TEXT NOT NULL,
		cycle TEXT NOT NULL,
		daily_attempts INTEGER NOT NULL DEFAULT 0,
		cycle_attempts INTEGER NOT NULL DEFAULT 0,
		last_token TEXT NOT NULL DEFAULT ''
	)`,
	`INSERT OR IGNORE INTO og_generation_budget (id, day, cycle) VALUES (1, '', '')`,
	`CREATE TABLE IF NOT EXISTS og_generation_leases (
		image_key TEXT PRIMARY KEY,
		token TEXT NOT NULL,
		expires_at INTEGER NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS og_generation_leases_expiry ON og_generation_leases (expires_at)`
];

function limit(value: string | undefined, fallback: number): number {
	if (value === undefined) return fallback;
	return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : -1;
}

export function budgetPeriods(now: number, startDay: number) {
	const date = new Date(now);
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();
	const cycleMonth = date.getUTCDate() < startDay ? month - 1 : month;
	return {
		day: date.toISOString().slice(0, 10),
		cycle: new Date(Date.UTC(year, cycleMonth, startDay)).toISOString().slice(0, 10)
	};
}

/**
 * Atomically claims one global generation slot and the per-image lease. D1
 * batch() is transactional, so a denied attempt writes neither. The last
 * `OG_DAILY_SOCIAL_RESERVE` daily slots are only available when `reserved`.
 */
export async function claimGeneration(
	env: OgBudgetEnv,
	key: string,
	now = Date.now(),
	reserved = false
) {
	const dailyLimit = limit(env.OG_DAILY_GENERATION_LIMIT, 20);
	const cycleLimit = limit(env.OG_CYCLE_GENERATION_LIMIT, 300);
	const reserve = limit(env.OG_DAILY_SOCIAL_RESERVE, 0);
	const startDay = limit(env.OG_BILLING_CYCLE_START_DAY, 13);
	if (
		dailyLimit <= 0 ||
		cycleLimit <= 0 ||
		reserve < 0 ||
		reserve > dailyLimit ||
		startDay < 1 ||
		startDay > 28
	)
		return null;
	const dailyAllowance = reserved ? dailyLimit : dailyLimit - reserve;
	if (!dailyAllowance) return null;
	const { day, cycle } = budgetPeriods(now, startDay);
	const token = crypto.randomUUID();
	const claim = () =>
		env.DB.batch([
			env.DB.prepare(
				`
			UPDATE og_generation_budget
			SET day = ?, cycle = ?,
				daily_attempts = CASE WHEN day < ? THEN 1 ELSE daily_attempts + 1 END,
				cycle_attempts = CASE WHEN cycle < ? THEN 1 ELSE cycle_attempts + 1 END,
				last_token = ?
			WHERE id = 1 AND day <= ? AND cycle <= ?
				AND (day < ? OR daily_attempts < ?)
				AND (cycle < ? OR cycle_attempts < ?)
				AND NOT EXISTS (
					SELECT 1 FROM og_generation_leases WHERE image_key = ? AND expires_at > ?
				)
		`
			).bind(
				day,
				cycle,
				day,
				cycle,
				token,
				day,
				cycle,
				day,
				dailyAllowance,
				cycle,
				cycleLimit,
				key,
				now
			),
			env.DB.prepare(
				`
			INSERT INTO og_generation_leases (image_key, token, expires_at)
			SELECT ?, ?, ? FROM og_generation_budget WHERE id = 1 AND last_token = ?
			ON CONFLICT (image_key) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at
		`
			).bind(key, token, now + LEASE_MS, token)
		]);
	let results;
	try {
		results = await claim();
	} catch (cause) {
		if (!/no such table/i.test(cause instanceof Error ? cause.message : String(cause))) throw cause;
		await env.DB.batch(OG_SCHEMA.map((statement) => env.DB.prepare(statement)));
		results = await claim();
	}
	if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) return null;
	return token;
}

export async function releaseGeneration(db: D1Database, key: string, token: string) {
	await db
		.prepare('DELETE FROM og_generation_leases WHERE image_key = ? AND token = ?')
		.bind(key, token)
		.run();
}

/** Only run after admission, not on every public request. */
export async function pruneExpiredLeases(db: D1Database) {
	await db.prepare('DELETE FROM og_generation_leases WHERE expires_at <= ?').bind(Date.now()).run();
}
