import { AppError } from '../../errors/app-error.js';
import type { IDemoSessionRepository } from '../../repositories/demo-session.repository.js';
import { buildDemoInvoice, DEMO_DOCUMENT_FILENAMES, type DemoDocumentKind, type IDemoInvoice } from '../../demo/demo-scenario.js';
import { renderDemoDocument } from '../../demo/demo-pdf.renderer.js';

type RenderDocument = (invoice: IDemoInvoice) => Promise<Buffer>;

export class GetDemoDocumentUseCase {
  constructor(
    private readonly sessions: IDemoSessionRepository,
    private readonly render: RenderDocument = renderDemoDocument,
  ) {}

  async execute({ userId, sessionId, kind }: { userId: string; sessionId: string; kind: DemoDocumentKind }) {
    // Autorização antes de qualquer geração.
    const session = await this.sessions.findByIdForOwner(sessionId, userId);
    if (!session) throw new AppError('Sessão de demonstração não encontrada.', 404);
    if (session.state !== 'ACTIVE') {
      throw new AppError('Esta sessão de demonstração foi arquivada. Use a sessão atual.', 409);
    }

    const content = await this.render(buildDemoInvoice(kind, session.id));
    return { filename: DEMO_DOCUMENT_FILENAMES[kind], content };
  }
}
