import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['src', 'scripts', 'test'];
const EXTENSIONS = new Set(['.js', '.mjs']);
const SKIPPED_DIRECTORIES = new Set(['artifacts', 'cache', 'coverage', 'dist', 'node_modules']);

function collectFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(resolved, files);
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(resolved);
  }
  return files;
}

const files = ROOTS
  .filter((directory) => {
    try {
      return statSync(directory).isDirectory();
    } catch {
      return false;
    }
  })
  .flatMap((directory) => collectFiles(directory))
  .concat(['hardhat.config.js', 'vite.config.js']);

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log(`JavaScript syntax check passed for ${files.length} files.`);
