import type { IDemoSessionRepository } from '../../repositories/demo-session.repository.js';
import { type DemoDocumentKind, type IDemoInvoice } from '../../demo/demo-scenario.js';
type RenderDocument = (invoice: IDemoInvoice) => Promise<Buffer>;
export declare class GetDemoDocumentUseCase {
    private readonly sessions;
    private readonly render;
    constructor(sessions: IDemoSessionRepository, render?: RenderDocument);
    execute({ userId, sessionId, kind }: {
        userId: string;
        sessionId: string;
        kind: DemoDocumentKind;
    }): Promise<{
        filename: string;
        content: Buffer<ArrayBufferLike>;
    }>;
}
export {};
//# sourceMappingURL=get-demo-document.use-case.d.ts.map