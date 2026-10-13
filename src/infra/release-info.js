import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const UNKNOWN = 'unknown';
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
function safeSha(value) {
    return typeof value === 'string' && SHA_PATTERN.test(value) ? value.toLowerCase() : UNKNOWN;
}
function readWebSha(webDistDir) {
    if (!webDistDir)
        return null;
    try {
        const parsed = JSON.parse(readFileSync(join(webDistDir, 'version.json'), 'utf8'));
        const sha = typeof parsed === 'object' && parsed !== null && 'sha' in parsed ? safeSha(parsed.sha) : UNKNOWN;
        return sha === UNKNOWN ? null : { sha };
    }
    catch {
        return null;
    }
}
/**
 * Identificador público e não sensível da release em execução. Só aceita SHA
 * hexadecimal (commit da plataforma ou `RELEASE_SHA`); nunca expõe configuração.
 */
export function readReleaseInfo(environment, webDistDir) {
    const apiSha = [environment.RENDER_GIT_COMMIT, environment.RELEASE_SHA]
        .map(safeSha)
        .find((sha) => sha !== UNKNOWN) ?? UNKNOWN;
    return { api: { sha: apiSha }, web: readWebSha(webDistDir) };
}
//# sourceMappingURL=release-info.js.map