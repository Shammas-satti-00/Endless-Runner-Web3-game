import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const excludedDirectories = new Set([
  'node_modules',
  'dist',
  'artifacts',
  'cache',
  'coverage',
  '.hardhat-data',
  '.vite',
]);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function collectDocuments(directory, documents = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) {
        collectDocuments(join(directory, entry.name), documents);
      }
      continue;
    }
    if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
      documents.push(relative(projectRoot, join(directory, entry.name)));
    }
  }
  return documents;
}

const documents = collectDocuments(projectRoot).sort();
assert(
  documents.length === 1 && documents[0] === 'README.md',
  `Only README.md may remain as project documentation. Found: ${documents.join(', ')}`,
);

const readme = readFileSync(join(projectRoot, 'README.md'), 'utf8');
const viteConfig = readFileSync(join(projectRoot, 'vite.config.js'), 'utf8');
const envExample = readFileSync(join(projectRoot, '.env.example'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

assert(readme.startsWith('# ShredRunner'), 'README must open with the project name.');
assert(!/\bV\d+\b/.test(readme), 'README must not contain release-version labels.');
assert(!/\brelease history\b|\bchangelog\b/i.test(readme), 'README must describe the project, not its release history.');

for (const section of [
  '## Project highlights',
  '## Architecture',
  '## Gameplay',
  '## Environment',
  '## Performance strategy',
  '## Vite and Node polyfills',
  '## Wallet integration',
  '## RUSH Momentum Engine',
  '## Installation',
  '## Security requirements',
  '## Assets and attribution',
]) {
  assert(readme.includes(section), `README section is missing: ${section}`);
}

assert(packageJson.name === 'shredrunner', `Unexpected package name: ${packageJson.name}`);
assert(
  packageJson.devDependencies?.['@esbuild-plugins/node-globals-polyfill'] === '^0.2.3',
  '@esbuild-plugins/node-globals-polyfill is not pinned in devDependencies.',
);
assert(
  packageJson.devDependencies?.['rollup-plugin-node-polyfills'] === '^0.2.1',
  'rollup-plugin-node-polyfills is not pinned in devDependencies.',
);
assert(!packageJson.devDependencies?.['rollup-plugin-polyfill-node'], 'The replaced polyfill package is still installed.');
for (const marker of [
  "import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';",
  "import { defineConfig, loadEnv } from 'vite';",
  "import { fileURLToPath } from 'node:url';",
  "import nodePolyfills from 'rollup-plugin-node-polyfills';",
  'export default defineConfig(({ mode }) => {',
  "loadEnv(mode, process.cwd(), '')",
  "const base = env.VITE_BASE_URL || '/';",
  "host: '0.0.0.0'",
  'allowedHosts: true',
  'NodeGlobalsPolyfillPlugin({',
  'process: true',
  'buffer: true',
  'plugins: [nodePolyfills()]',
  "global: 'globalThis'",
  'process: processPolyfill',
  "'node:process': processPolyfill",
  'buffer: bufferPolyfill',
  "'node:buffer': bufferPolyfill",
  "'@game': fromProject('./src/game')",
  "'@web3': fromProject('./src/web3')",
]) {
  assert(viteConfig.includes(marker), `Vite Node-polyfill configuration is missing: ${marker}`);
}
for (const variable of [
  'VITE_BASE_URL=/',
  'VITE_PORT=5173',
  'VITE_PREVIEW_PORT=4173',
  'VITE_HMR_CLIENT_PORT=5173',
]) {
  assert(envExample.includes(variable), `.env.example is missing: ${variable}`);
}

console.log(JSON.stringify({
  documentation: documents,
  readmeProjectFocused: true,
  vite: {
    environmentDrivenConfig: true,
    dependencyGlobals: '@esbuild-plugins/node-globals-polyfill@0.2.3',
    productionNodeModules: 'rollup-plugin-node-polyfills@0.2.1',
    browserGlobal: 'globalThis',
    aliases: ['@', '@game', '@web3', '@assets'],
  },
}, null, 2));
