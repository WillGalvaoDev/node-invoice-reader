import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../errors/app-error.js';
import type { IDemoSession, IDemoSessionRepository } from '../../repositories/demo-session.repository.js';
import { deriveDemoAccessKey } from '../../demo/demo-scenario.js';
import { PrepareDemoSessionUseCase } from './prepare-demo-session.use-case.js';
import { GetCurrentDemoSessionUseCase } from './get-current-demo-session.use-case.js';
import { RestartDemoSessionUseCase } from './restart-demo-session.use-case.js';
import { GetDemoDocumentUseCase } from './get-demo-document.use-case.js';
import { toDemoSessionView } from './demo-session.view.js';

const OWNER = 'owner-1';
const session = (overrides: Partial<IDemoSession> = {}): IDemoSession => ({
  id: 'session-1', ownerId: OWNER, companyId: 'company-1', stockId: 'stock-1', state: 'ACTIVE',
  successorId: null, createdAt: new Date('2026-10-10T00:00:00Z'), archivedAt: null, ...overrides,
});

describe('casos de uso da sessão de demonstração', () => {
  const repositoryMock = {
    findActiveByOwner: vi.fn(),
    findByIdForOwner: vi.fn(),
    createForOwner: vi.fn(),
    restart: vi.fn(),
  };
  const repository = repositoryMock as unknown as IDemoSessionRepository;
  const render = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    render.mockResolvedValue(Buffer.from('%PDF-synthetic'));
  });

  describe('PrepareDemoSessionUseCase', () => {
    it('cria identidade sintética nova a cada chamada e informa se houve criação', async () => {
      repositoryMock.createForOwner.mockImplementation(async (_owner: string, factory: () => unknown) => {
        factory();
        return { session: session(), created: true };
      });
      const sut = new PrepareDemoSessionUseCase(repository);

      const result = await sut.execute({ userId: OWNER });

      expect(result).toEqual({ session: session(), created: true });
      const factory = repositoryMock.createForOwner.mock.calls[0]![1] as () => {
        sessionId: string; cnpj: string; accessKeys: { initial: string; followup: string };
      };
      const first = factory();
      const second = factory();
      expect(first.sessionId).not.toBe(second.sessionId);
      expect(first.cnpj).toMatch(/^\d{14}$/);
      expect(first.accessKeys).toEqual({
        initial: deriveDemoAccessKey(first.sessionId, 'initial'),
        followup: deriveDemoAccessKey(first.sessionId, 'followup'),
      });
    });
  });

  describe('GetCurrentDemoSessionUseCase', () => {
    it('retorna a sessão ativa do próprio usuário', async () => {
      repositoryMock.findActiveByOwner.mockResolvedValue(session());
      await expect(new GetCurrentDemoSessionUseCase(repository).execute({ userId: OWNER })).resolves.toEqual(session());
      expect(repositoryMock.findActiveByOwner).toHaveBeenCalledWith(OWNER);
    });

    it('responde 404 quando não há sessão ativa', async () => {
      repositoryMock.findActiveByOwner.mockResolvedValue(null);
      await expect(new GetCurrentDemoSessionUseCase(repository).execute({ userId: OWNER }))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('RestartDemoSessionUseCase', () => {
    it('devolve a sucessora e responde 404 idêntico para sessão alheia ou inexistente', async () => {
      repositoryMock.restart.mockResolvedValueOnce(session({ id: 'session-2' })).mockResolvedValueOnce(null);
      const sut = new RestartDemoSessionUseCase(repository);

      await expect(sut.execute({ userId: OWNER, sessionId: 'session-1' })).resolves.toMatchObject({ id: 'session-2' });
      const error = await sut.execute({ userId: OWNER, sessionId: 'foreign' }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ statusCode: 404 });
    });
  });

  describe('GetDemoDocumentUseCase', () => {
    it('autoriza antes de renderizar e usa a chave da própria sessão', async () => {
      repositoryMock.findByIdForOwner.mockResolvedValue(session());
      const sut = new GetDemoDocumentUseCase(repository, render);

      const result = await sut.execute({ userId: OWNER, sessionId: 'session-1', kind: 'followup' });

      expect(repositoryMock.findByIdForOwner).toHaveBeenCalledWith('session-1', OWNER);
      expect(render).toHaveBeenCalledOnce();
      expect(render.mock.calls[0]![0]).toMatchObject({ accessKey: deriveDemoAccessKey('session-1', 'followup') });
      expect(result).toEqual({ filename: 'demo-completa.pdf', content: Buffer.from('%PDF-synthetic') });
    });

    it('não renderiza para sessão alheia/inexistente (404) nem para sessão arquivada (409)', async () => {
      const sut = new GetDemoDocumentUseCase(repository, render);
      repositoryMock.findByIdForOwner.mockResolvedValueOnce(null);
      await expect(sut.execute({ userId: 'intruder', sessionId: 'session-1', kind: 'initial' }))
        .rejects.toMatchObject({ statusCode: 404 });

      repositoryMock.findByIdForOwner.mockResolvedValueOnce(session({ state: 'ARCHIVED', successorId: 's2' }));
      await expect(sut.execute({ userId: OWNER, sessionId: 'session-1', kind: 'initial' }))
        .rejects.toMatchObject({ statusCode: 409 });

      expect(render).not.toHaveBeenCalled();
    });
  });

  describe('toDemoSessionView', () => {
    it('expõe IDs, estado, URLs relativas e resultados esperados, sem chaves nem CNPJ', () => {
      const view = toDemoSessionView(session());

      expect(view).toMatchObject({
        id: 'session-1', companyId: 'company-1', stockId: 'stock-1', state: 'ACTIVE',
        documents: [
          { kind: 'initial', filename: 'demo-inicial.pdf', url: '/demo/sessions/session-1/documents/initial' },
          { kind: 'followup', filename: 'demo-completa.pdf', url: '/demo/sessions/session-1/documents/followup' },
        ],
      });
      expect(view.expectedResults.initial.products).toEqual([{ code: 'CAN-A', quantity: 10 }]);
      expect(view.expectedResults.followup.products.map((item) => item.code)).toEqual(['CAN-A', 'CAD-A', 'CAN-B']);
      const serialized = JSON.stringify(view);
      expect(serialized).not.toContain('ownerId');
      expect(serialized).not.toMatch(/\d{44}/);
    });
  });
});
