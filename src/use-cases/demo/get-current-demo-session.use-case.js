import { AppError } from '../../errors/app-error.js';
export class GetCurrentDemoSessionUseCase {
    sessions;
    constructor(sessions) {
        this.sessions = sessions;
    }
    async execute({ userId }) {
        const session = await this.sessions.findActiveByOwner(userId);
        if (!session)
            throw new AppError('Nenhuma sessão de demonstração ativa.', 404);
        return session;
    }
}
//# sourceMappingURL=get-current-demo-session.use-case.js.map