import type { DemoIdentityFactory, IDemoSession, IDemoSessionRepository } from '../../repositories/demo-session.repository.js';
export declare class RestartDemoSessionUseCase {
    private readonly sessions;
    private readonly identity;
    constructor(sessions: IDemoSessionRepository, identity?: DemoIdentityFactory);
    execute({ userId, sessionId }: {
        userId: string;
        sessionId: string;
    }): Promise<IDemoSession>;
}
//# sourceMappingURL=restart-demo-session.use-case.d.ts.map