import { AppError } from '../../errors/app-error.js';
import { newDemoIdentity } from './prepare-demo-session.use-case.js';
export class RestartDemoSessionUseCase {
    sessions;
    identity;
    constructor(sessions, identity = newDemoIdentity) {
        this.sessions = sessions;
        this.identity = identity;
    }
    async execute({ userId, sessionId }) {
        const successor = await this.sessions.restart(sessionId, userId, this.identity);
        // Sessão alheia e inexistente produzem a mesma resposta (anti-enumeração).
        if (!successor)
            throw new AppError('Sessão de demonstração não encontrada.', 404);
        return successor;
    }
}
//# sourceMappingURL=restart-demo-session.use-case.js.map