import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const varsPath = path.join(root, 'api/.dev.vars');
const endpointLine = 'CONTRAIL_PUBLIC_ENDPOINT="http://127.0.0.1:8787"';

let contents = '';
try {
	contents = await readFile(varsPath, 'utf8');
} catch {
	// The local vars file is created on first use and remains ignored.
}

if (!/^CONTRAIL_PUBLIC_ENDPOINT=/m.test(contents)) {
	const separator = contents && !contents.endsWith('\n') ? '\n' : '';
	await writeFile(varsPath, `${contents}${separator}${endpointLine}\n`);
}
