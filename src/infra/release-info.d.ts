export interface ReleaseInfo {
    api: {
        sha: string;
    };
    web: {
        sha: string;
    } | null;
}
/**
 * Identificador público e não sensível da release em execução. Só aceita SHA
 * hexadecimal (commit da plataforma ou `RELEASE_SHA`); nunca expõe configuração.
 */
export declare function readReleaseInfo(environment: Record<string, string | undefined>, webDistDir: string | undefined): ReleaseInfo;
//# sourceMappingURL=release-info.d.ts.map