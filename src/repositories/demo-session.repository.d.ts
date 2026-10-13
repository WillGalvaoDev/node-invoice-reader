import type { DemoDocumentKind } from '../demo/demo-scenario.js';
export type DemoSessionState = 'ACTIVE' | 'ARCHIVED';
export interface IDemoSession {
    id: string;
    ownerId: string;
    companyId: string;
    stockId: string;
    state: DemoSessionState;
    successorId: string | null;
    createdAt: Date;
    archivedAt: Date | null;
}
/** Identidade sintética candidata de uma sessão: gerada fora do repositório, validada por ele. */
export interface IDemoIdentity {
    sessionId: string;
    cnpj: string;
    accessKeys: Record<DemoDocumentKind, string>;
}
export type DemoIdentityFactory = () => IDemoIdentity;
export interface IDemoSessionRepository {
    findActiveByOwner(ownerId: string): Promise<IDemoSession | null>;
    /** Escopado ao dono: sessão alheia é indistinguível de inexistente. */
    findByIdForOwner(id: string, ownerId: string): Promise<IDemoSession | null>;
    /** Devolve a sessão ativa existente (`created: false`) ou cria empresa, estoque, sessão e chaves atomicamente. */
    createForOwner(ownerId: string, identity: DemoIdentityFactory): Promise<{
        session: IDemoSession;
        created: boolean;
    }>;
    /** Idempotente por ID antigo; `null` quando a sessão não existe para o dono. */
    restart(sessionId: string, ownerId: string, identity: DemoIdentityFactory): Promise<IDemoSession | null>;
}
//# sourceMappingURL=demo-session.repository.d.ts.map