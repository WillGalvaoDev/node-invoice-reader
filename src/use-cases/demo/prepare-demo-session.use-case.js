import { randomUUID } from 'node:crypto';
import { deriveDemoAccessKey } from '../../demo/demo-scenario.js';
import { generateSyntheticCnpj } from '../../demo/synthetic-cnpj.js';
/** Nova identidade sintética a cada chamada: ID, CNPJ e chaves não se repetem. */
export const newDemoIdentity = () => {
    const sessionId = randomUUID();
    return {
        sessionId,
        cnpj: generateSyntheticCnpj(),
        accessKeys: {
            initial: deriveDemoAccessKey(sessionId, 'initial'),
            followup: deriveDemoAccessKey(sessionId, 'followup'),
        },
    };
};
export class PrepareDemoSessionUseCase {
    sessions;
    identity;
    constructor(sessions, identity = newDemoIdentity) {
        this.sessions = sessions;
        this.identity = identity;
    }
    /** Não chama IA nem insere produtos: o estoque só muda por upload e decisão reais. */
    async execute({ userId }) {
        return this.sessions.createForOwner(userId, this.identity);
    }
}
//# sourceMappingURL=prepare-demo-session.use-case.js.map