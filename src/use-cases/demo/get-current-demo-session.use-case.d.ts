import type { IDemoSession, IDemoSessionRepository } from '../../repositories/demo-session.repository.js';
export declare class GetCurrentDemoSessionUseCase {
    private readonly sessions;
    constructor(sessions: IDemoSessionRepository);
    execute({ userId }: {
        userId: string;
    }): Promise<IDemoSession>;
}
//# sourceMappingURL=get-current-demo-session.use-case.d.ts.map