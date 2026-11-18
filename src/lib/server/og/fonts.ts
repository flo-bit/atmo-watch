import regular from './fonts/NotoSans-Regular.ttf?inline';
import bold from './fonts/NotoSans-Bold.ttf?inline';

function decode(dataUrl: string): ArrayBuffer {
	const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
	return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)).buffer;
}

let fonts: { name: string; weight: 400 | 700; style: 'normal'; data: ArrayBuffer }[] | undefined;

/** Bundled, not fetched. Decoded on first render so cold starts do not pay for it. */
export function ogFonts() {
	return (fonts ??= [
		{ name: 'Inter', weight: 400, style: 'normal', data: decode(regular) },
		{ name: 'Inter', weight: 700, style: 'normal', data: decode(bold) }
	]);
}
