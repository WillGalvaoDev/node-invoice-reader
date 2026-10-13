import { type DemoDocumentKind } from '../../demo/demo-scenario.js';
import type { IDemoSession } from '../../repositories/demo-session.repository.js';
interface IExpectedResult {
    summary: string;
    products: Array<{
        code: string;
        quantity: number;
    }>;
}
export interface IDemoSessionView {
    id: string;
    companyId: string;
    stockId: string;
    state: IDemoSession['state'];
    createdAt: Date;
    documents: Array<{
        kind: DemoDocumentKind;
        filename: string;
        url: string;
    }>;
    expectedResults: Record<DemoDocumentKind, IExpectedResult>;
}
/** Projeção pública: nunca inclui dono, chaves de acesso ou configuração. */
export declare function toDemoSessionView(session: IDemoSession): IDemoSessionView;
export {};
//# sourceMappingURL=demo-session.view.d.ts.map