import { DEMO_DOCUMENT_FILENAMES, DEMO_DOCUMENT_KINDS, DEMO_SCENARIO, type DemoDocumentKind } from '../../demo/demo-scenario.js';
import type { IDemoSession } from '../../repositories/demo-session.repository.js';

interface IExpectedResult {
  summary: string;
  products: Array<{ code: string; quantity: number }>;
}

const EXPECTED_SUMMARY: Record<DemoDocumentKind, string> = {
  initial: 'Uma extração por IA; CAN-A entra com 10 unidades; nenhuma sugestão pendente.',
  followup: 'Uma extração e duas comparações por IA; CAN-A soma 2 (total 12), CAD-A nasce com 1 e '
    + 'CAN-B vira sugestão pendente para CAN-A. A resposta da IA é probabilística e deve ser revisada.',
};

export interface IDemoSessionView {
  id: string;
  companyId: string;
  stockId: string;
  state: IDemoSession['state'];
  createdAt: Date;
  documents: Array<{ kind: DemoDocumentKind; filename: string; url: string }>;
  expectedResults: Record<DemoDocumentKind, IExpectedResult>;
}

/** Projeção pública: nunca inclui dono, chaves de acesso ou configuração. */
export function toDemoSessionView(session: IDemoSession): IDemoSessionView {
  return {
    id: session.id,
    companyId: session.companyId,
    stockId: session.stockId,
    state: session.state,
    createdAt: session.createdAt,
    documents: DEMO_DOCUMENT_KINDS.map((kind) => ({
      kind,
      filename: DEMO_DOCUMENT_FILENAMES[kind],
      url: `/demo/sessions/${session.id}/documents/${kind}`,
    })),
    expectedResults: {
      initial: expectedResult('initial'),
      followup: expectedResult('followup'),
    },
  };
}

function expectedResult(kind: DemoDocumentKind): IExpectedResult {
  return {
    summary: EXPECTED_SUMMARY[kind],
    products: DEMO_SCENARIO[kind].products.map(({ code, quantity }) => ({ code, quantity })),
  };
}
