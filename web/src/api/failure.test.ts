import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from './client';
import { describeFailure } from './failure';

describe('describeFailure', () => {
  it('401: encerra a sessão local e pede novo login', () => {
    const failure = describeFailure(new ApiError(401, 'Token inválido.'), 'upload');
    expect(failure).toMatchObject({ kind: 'session-expired', reload: false });
    expect(failure.message).toMatch(/entre novamente/i);
  });

  it.each([403, 404])('%i: indisponibilidade sem expor recurso de outra conta', (status) => {
    const failure = describeFailure(new ApiError(status, 'Estoque X pertence à empresa Y.'), 'upload');
    expect(failure.kind).toBe('unavailable');
    expect(failure.message).not.toContain('Estoque X');
  });

  it('409 em upload: nota duplicada, recarrega estoque e sugestões', () => {
    const failure = describeFailure(new ApiError(409, 'Esta NF-e já foi processada.'), 'upload');
    expect(failure).toMatchObject({ kind: 'duplicate', reload: true });
    expect(failure.message).toMatch(/já foi processada/i);
  });

  it('409 em decisão: sugestão já decidida, recarrega', () => {
    const failure = describeFailure(new ApiError(409, 'Sugestão já decidida.'), 'decision');
    expect(failure).toMatchObject({ kind: 'already-decided', reload: true });
  });

  it('409 em decisão por código ocupado mantém a mensagem do servidor e não afirma decisão prévia', () => {
    const failure = describeFailure(
      new ApiError(409, 'Já existe um produto com este código no estoque. A sugestão continua pendente.'), 'decision',
    );
    expect(failure.message).toContain('Já existe um produto com este código');
    expect(failure.kind).not.toBe('already-decided');
  });

  it('422: problema do documento com a mensagem do servidor e garantia de nada alterado', () => {
    const failure = describeFailure(new ApiError(422, 'O código já existe neste estoque com fornecedor ou unidade incompatível.'), 'upload');
    expect(failure.kind).toBe('document');
    expect(failure.message).toContain('fornecedor ou unidade incompatível');
    expect(failure.message).toMatch(/nada foi alterado|nenhuma alteração/i);
  });

  it('429 local: usa Retry-After somente quando fornecido', () => {
    expect(describeFailure(new ApiError(429, 'x', 42), 'upload').message).toContain('42');
    const without = describeFailure(new ApiError(429, 'x'), 'upload');
    expect(without.kind).toBe('rate-limit');
    expect(without.message).not.toMatch(/\d+ segundos/);
  });

  it('503: indisponibilidade do provedor sem prometer horário e sem afirmar mudança no estoque', () => {
    const failure = describeFailure(new ApiError(503, 'O serviço de IA atingiu um limite temporário. Nenhuma alteração desta nota foi aplicada ao estoque. Tente novamente mais tarde.'), 'upload');
    expect(failure).toMatchObject({ kind: 'provider-unavailable', canRetry: true });
    expect(failure.message).toMatch(/nenhuma alteração/i);
    expect(failure.message).not.toMatch(/\d+ (minutos|horas|segundos)/);
  });

  it('falha de rede após envio: estado desconhecido, consultar antes de reenviar, sem alegar rollback', () => {
    const failure = describeFailure(new NetworkError(), 'upload');
    expect(failure).toMatchObject({ kind: 'unknown-state', reload: true });
    expect(failure.message).toMatch(/pode ou não/i);
    expect(failure.message).not.toMatch(/revertid|rollback|desfeit/i);
  });

  it('erro desconhecido cai em mensagem genérica segura', () => {
    expect(describeFailure(new Error('boom <script>'), 'upload').message).not.toContain('<script>');
  });
});
