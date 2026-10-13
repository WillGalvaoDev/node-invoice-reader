import { AppError } from '../../errors/app-error.js';
import { buildDemoInvoice, DEMO_DOCUMENT_FILENAMES } from '../../demo/demo-scenario.js';
import { renderDemoDocument } from '../../demo/demo-pdf.renderer.js';
export class GetDemoDocumentUseCase {
    sessions;
    render;
    constructor(sessions, render = renderDemoDocument) {
        this.sessions = sessions;
        this.render = render;
    }
    async execute({ userId, sessionId, kind }) {
        // Autorização antes de qualquer geração.
        const session = await this.sessions.findByIdForOwner(sessionId, userId);
        if (!session)
            throw new AppError('Sessão de demonstração não encontrada.', 404);
        if (session.state !== 'ACTIVE') {
            throw new AppError('Esta sessão de demonstração foi arquivada. Use a sessão atual.', 409);
        }
        const content = await this.render(buildDemoInvoice(kind, session.id));
        return { filename: DEMO_DOCUMENT_FILENAMES[kind], content };
    }
}
//# sourceMappingURL=get-demo-document.use-case.js.map