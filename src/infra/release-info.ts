import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ReleaseInfo {
  api: { sha: string };
  web: { sha: string } | null;
}

const UNKNOWN = 'unknown';
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

function safeSha(value: unknown): string {
  return typeof value === 'string' && SHA_PATTERN.test(value) ? value.toLowerCase() : UNKNOWN;
}

function readWebSha(webDistDir: string | undefined): { sha: string } | null {
  if (!webDistDir) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(webDistDir, 'version.json'), 'utf8'));
    const sha = typeof parsed === 'object' && parsed !== null && 'sha' in parsed ? safeSha(parsed.sha) : UNKNOWN;
    return sha === UNKNOWN ? null : { sha };
  } catch {
    return null;
  }
}

/**
 * Identificador público e não sensível da release em execução. Só aceita SHA
 * hexadecimal (commit da plataforma ou `RELEASE_SHA`); nunca expõe configuração.
 */
export function readReleaseInfo(
  environment: Record<string, string | undefined>,
  webDistDir: string | undefined,
): ReleaseInfo {
  const apiSha = [environment.RENDER_GIT_COMMIT, environment.RELEASE_SHA]
    .map(safeSha)
    .find((sha) => sha !== UNKNOWN) ?? UNKNOWN;

  return { api: { sha: apiSha }, web: readWebSha(webDistDir) };
}
