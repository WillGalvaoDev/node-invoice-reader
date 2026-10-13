import type { DemoIdentityFactory, IDemoSession, IDemoSessionRepository } from '../../repositories/demo-session.repository.js';
/** Nova identidade sintética a cada chamada: ID, CNPJ e chaves não se repetem. */
export declare const newDemoIdentity: DemoIdentityFactory;
export declare class PrepareDemoSessionUseCase {
    private readonly sessions;
    private readonly identity;
    constructor(sessions: IDemoSessionRepository, identity?: DemoIdentityFactory);
    /** Não chama IA nem insere produtos: o estoque só muda por upload e decisão reais. */
    execute({ userId }: {
        userId: string;
    }): Promise<{
        session: IDemoSession;
        created: boolean;
    }>;
}
//# sourceMappingURL=prepare-demo-session.use-case.d.ts.map