import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));

function isExecutable(candidate) {
  if (!candidate.includes('/')) {
    return spawnSync('which', [candidate], { stdio: 'pipe' }).status === 0;
  }

  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveBinary(envName, candidates) {
  if (process.env[envName]) {
    return process.env[envName];
  }

  return candidates.find(isExecutable) ?? candidates[0];
}

export const binaries = [
  ['redis-server', resolveBinary('REDIS_BIN', ['redis-server'])],
  [
    'livekit-server',
    resolveBinary('LIVEKIT_SERVER_BIN', [
      path.join(appDir, 'bin/livekit-server'),
      'livekit-server',
    ]),
  ],
  [
    'egress',
    resolveBinary('LIVEKIT_EGRESS_BIN', [
      path.join(appDir, 'bin/livekit-egress'),
      'livekit-egress',
      'egress',
      'server',
    ]),
  ],
];

export function checkBinaries({ quiet = false } = {}) {
  let ok = true;

  for (const [label, bin] of binaries) {
    if (isExecutable(bin)) {
      if (!quiet) {
        process.stdout.write(`${label}: ${bin}\n`);
      }
    } else {
      ok = false;
      if (!quiet) {
        process.stderr.write(`${label}: missing (${bin})\n`);
      }
    }
  }

  return ok;
}

export function printInstallHelp() {
  process.stderr.write(`
Install the missing host binaries and rerun:

  pnpm --filter @anuva/livekit check

Binary paths can be overridden with REDIS_BIN, LIVEKIT_SERVER_BIN, and LIVEKIT_EGRESS_BIN.
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ok = checkBinaries();
  if (!ok) {
    printInstallHelp();
    process.exit(1);
  }
}
