import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type LaunchOptions } from 'playwright';

const WIDTH = 1200;
const HEIGHT = 630;
const POSTERS_PER_ROW = 10;
const OUTPUT_PATH = path.resolve('static/og.png');
const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_IMAGES = 'https://image.tmdb.org/t/p/w342';

type MediaKind = 'movie' | 'tv';

type TrendingItem = {
	id: number;
	name?: string;
	poster_path: string | null;
	title?: string;
};

type Poster = {
	dataUrl: string;
	kind: MediaKind;
	title: string;
};

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function tmdbCredential() {
	const credential = [process.env.TMDB_ACCESS_TOKEN, process.env.TMDB_API_KEY]
		.map((value) => value?.trim())
		.find(Boolean);

	if (!credential) {
		throw new Error('Set TMDB_ACCESS_TOKEN or TMDB_API_KEY before generating the OG image.');
	}

	return credential;
}

async function tmdb<T>(pathname: string): Promise<T> {
	const credential = tmdbCredential();
	const url = new URL(`${TMDB_API}${pathname}`);
	url.searchParams.set('language', 'en-US');

	const headers: Record<string, string> = { accept: 'application/json' };
	if (credential.startsWith('eyJ')) {
		headers.Authorization = `Bearer ${credential}`;
	} else {
		url.searchParams.set('api_key', credential);
	}

	const response = await fetch(url, { headers });
	if (!response.ok) {
		throw new Error(`TMDB ${pathname} failed (${response.status}): ${await response.text()}`);
	}

	return response.json() as Promise<T>;
}

async function trending(kind: MediaKind) {
	const data = await tmdb<{ results: TrendingItem[] }>(`/trending/${kind}/week`);
	return data.results
		.filter((item): item is TrendingItem & { poster_path: string } => Boolean(item.poster_path))
		.map((item) => ({
			kind,
			posterPath: item.poster_path,
			title: item.title ?? item.name ?? `${kind} ${item.id}`
		}));
}

async function downloadPoster(item: Awaited<ReturnType<typeof trending>>[number]): Promise<Poster> {
	const response = await fetch(`${TMDB_IMAGES}${item.posterPath}`);
	if (!response.ok) {
		throw new Error(`Could not download the poster for ${item.title} (${response.status}).`);
	}

	const mimeType = response.headers.get('content-type') ?? 'image/jpeg';
	const bytes = Buffer.from(await response.arrayBuffer());
	return {
		dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`,
		kind: item.kind,
		title: item.title
	};
}

function interleave<T>(left: T[], right: T[]) {
	return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => [
		left[index],
		right[index]
	])
		.flat()
		.filter((item): item is T => item !== undefined);
}

function posterMarkup(posters: Poster[]) {
	const angles = Array.from(
		{ length: POSTERS_PER_ROW },
		(_, index) => -70 + index * (140 / (POSTERS_PER_ROW - 1))
	);
	const rowY = [-245, 0, 245];
	const radius = 630;
	const depth = 290;
	const centerDepth = -120;

	return rowY
		.flatMap((y, row) =>
			angles.map((angle, column) => {
				const poster = posters[row * POSTERS_PER_ROW + column];
				const radians = (angle * Math.PI) / 180;
				const x = Math.sin(radians) * radius;
				const z = (1 - Math.cos(radians)) * depth + centerDepth;
				const brightness = 0.66 + Math.cos(radians) * 0.34;

				return `<div class="poster-slot" style="transform: translate3d(${x.toFixed(1)}px, ${y}px, ${z.toFixed(1)}px)">
					<div class="poster" style="filter: brightness(${brightness.toFixed(2)}); transform: translate(-50%, -50%) rotateY(${(-angle).toFixed(1)}deg)">
						<img src="${poster.dataUrl}" alt="${escapeHtml(poster.title)}" />
					</div>
				</div>`;
			})
		)
		.join('\n');
}

function template(posters: Poster[], font: string) {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<style>
		@font-face {
			font-family: "Inter";
			font-style: normal;
			font-weight: 600;
			font-display: block;
			src: url("${font}") format("woff2");
		}
		* { box-sizing: border-box; }
		html, body { width: ${WIDTH}px; height: ${HEIGHT}px; margin: 0; overflow: hidden; }
		body {
			background: #09090b;
			font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		}
		.canvas {
			position: relative;
			width: 100%;
			height: 100%;
			overflow: hidden;
			background:
				radial-gradient(circle at 50% 50%, #18121b 0, #09090b 72%);
			perspective: 900px;
			perspective-origin: 50% 50%;
		}
		.poster-wall {
			position: absolute;
			inset: 0;
			transform-style: preserve-3d;
		}
		.poster-slot {
			position: absolute;
			left: 50%;
			top: 50%;
			width: 0;
			height: 0;
			transform-style: preserve-3d;
		}
		.poster {
			position: absolute;
			width: 148px;
			height: 222px;
			overflow: hidden;
			border: 1px solid rgba(255, 255, 255, 0.18);
			border-radius: 10px;
			background: #18181b;
			box-shadow:
				0 22px 48px rgba(0, 0, 0, 0.8),
				0 0 22px rgba(237, 106, 255, 0.08);
			backface-visibility: hidden;
			transform-origin: center;
		}
		.poster img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
		.scrim {
			position: absolute;
			inset: 0;
			background:
				linear-gradient(to bottom, transparent 40%, rgba(9, 9, 11, 0.18) 57%, rgba(9, 9, 11, 0.88) 82%, #09090b 100%),
				radial-gradient(ellipse at center, transparent 42%, rgba(9, 9, 11, 0.2) 70%, rgba(9, 9, 11, 0.7) 100%);
		}
		.glow {
			position: absolute;
			left: 50%;
			bottom: -80px;
			width: 500px;
			height: 210px;
			border-radius: 50%;
			background: rgba(237, 106, 255, 0.13);
			filter: blur(75px);
			transform: translateX(-50%);
		}
		.brand {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: flex-end;
			justify-content: center;
			padding-bottom: 42px;
			color: #fafafa;
			text-shadow: 0 4px 28px rgba(0, 0, 0, 0.9);
		}
		.wordmark {
			font-size: 88px;
			font-weight: 600;
			letter-spacing: normal;
			line-height: 1;
		}
	</style>
</head>
<body>
	<div class="canvas">
		<div class="poster-wall">${posterMarkup(posters)}</div>
		<div class="scrim"></div>
		<div class="glow"></div>
		<div class="brand">
			<div class="wordmark">atmo.watch</div>
		</div>
	</div>
</body>
</html>`;
}

async function launchBrowser() {
	const configuredPath = process.env.OG_BROWSER_PATH?.trim();
	const options: LaunchOptions = configuredPath
		? { executablePath: configuredPath }
		: existsSync(chromium.executablePath())
			? {}
			: { channel: 'chrome' };

	try {
		return await chromium.launch(options);
	} catch (cause) {
		throw new Error(
			'Could not launch Chromium. Run `pnpm exec playwright install chromium` or set OG_BROWSER_PATH.',
			{ cause }
		);
	}
}

async function main() {
	const [movies, shows, interSemiBold] = await Promise.all([
		trending('movie'),
		trending('tv'),
		readFile(path.resolve('node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2'))
	]);
	const selected = interleave(movies, shows).slice(0, POSTERS_PER_ROW * 3);

	if (selected.length < POSTERS_PER_ROW * 3) {
		throw new Error(`TMDB returned only ${selected.length} posters; 30 are required.`);
	}

	console.log(`Downloading ${selected.length} current trending posters…`);
	const posters = await Promise.all(selected.map(downloadPoster));
	const font = `data:font/woff2;base64,${interSemiBold.toString('base64')}`;
	const browser = await launchBrowser();

	try {
		const context = await browser.newContext({
			colorScheme: 'dark',
			deviceScaleFactor: 1,
			viewport: { width: WIDTH, height: HEIGHT }
		});
		const page = await context.newPage();
		await page.setContent(template(posters, font), { waitUntil: 'load' });
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all(Array.from(document.images, (image) => image.decode()));
		});
		await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
		await page.screenshot({ path: OUTPUT_PATH, type: 'png' });
		await context.close();
	} finally {
		await browser.close();
	}

	console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
	console.log(posters.map((poster) => poster.title).join(' · '));
}

await main();
