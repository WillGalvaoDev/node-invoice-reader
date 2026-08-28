import { spawnSync } from 'node:child_process';

const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });

if (status.status !== 0) {
  process.stderr.write(status.stderr);
  process.exit(status.status ?? 1);
}

const dirty = status.stdout.trim();
if (dirty) {
  process.stderr.write('Artefatos compilados (.js/.d.ts/.map) divergem do fonte TypeScript commitado:\n');
  process.stderr.write(dirty + '\n');
  process.stderr.write('\nRode `npm run build` localmente e commit os artefatos regenerados antes de subir.\n');
  process.exit(1);
}

process.stdout.write('Artefatos compilados consistentes com o fonte commitado.\n');
