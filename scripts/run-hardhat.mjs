import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const hardhatCli = fileURLToPath(
  new URL('../node_modules/hardhat/dist/src/cli.js', import.meta.url),
);
const environment = {
  ...process.env,
  HARDHAT_DISABLE_TELEMETRY: 'true',
  XDG_DATA_HOME:
    process.env.XDG_DATA_HOME || path.join(projectRoot, '.hardhat-data'),
};

const result = spawnSync(
  process.execPath,
  [hardhatCli, ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env: environment,
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
