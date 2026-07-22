import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { binaries, checkBinaries, printInstallHelp } from './check.mjs';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const binaryByLabel = Object.fromEntries(binaries);

if (!checkBinaries()) {
  printInstallHelp();
  process.exit(1);
}

const processes = [
  {
    name: 'redis',
    bin: binaryByLabel['redis-server'],
    args: ['redis.conf'],
  },
  {
    name: 'livekit',
    bin: binaryByLabel['livekit-server'],
    args: ['--config', 'livekit.yaml'],
  },
  {
    name: 'egress',
    bin: binaryByLabel.egress,
    args: ['--config', 'egress.yaml'],
  },
];

const children = [];
let shuttingDown = false;

function stopAll(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const processDef of processes) {
  const child = spawn(processDef.bin, processDef.args, {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  children.push(child);

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${processDef.name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${processDef.name}] ${chunk}`);
  });

  child.on('error', (error) => {
    process.stderr.write(`[${processDef.name}] ${error.message}\n`);
    stopAll();
  });

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      process.stderr.write(`[${processDef.name}] exited with ${signal ?? code}\n`);
      stopAll();
      process.exitCode = code ?? 1;
    }
  });
}

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));
