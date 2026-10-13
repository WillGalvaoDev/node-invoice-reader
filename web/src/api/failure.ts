import { ApiError, NetworkError } from './client';

export type FailureContext = 'upload' | 'decision' | 'general';

export type FailureKind =
  | 'session-expired'
  | 'unavailable'
  | 'duplicate'
  | 'already-decided'
  | 'document'
  | 'rate-limit'
  | 'provider-unavailable'
  | 'unknown-state'
  | 'invalid'
  | 'generic';

export interface Failure {
  kind: FailureKind;
  message: string;
  /** Recarregar estoque e sugestões para refletir o estado persistido. */
  reload: boolean;
  /** Oferecer nova tentativa manual (nunca automática). */
  canRetry: boolean;
}

const failure = (kind: FailureKind, message: string, reload = false, canRetry = false): Failure => ({
  kind, message, reload, canRetry,
});

/**
 * Traduz erros da API em mensagens de interface. As mensagens do servidor são
 * texto de negócio controlado por nós; mesmo assim são exibidas como texto.
 */
export function describeFailure(error: unknown, context: FailureContext): Failure {
  if (error instanceof NetworkError) {
    return failure(
      'unknown-state',
      'Não recebemos resposta do servidor. A operação pode ou não ter sido processada. '
        + 'Confira o estoque e as sugestões pendentes antes de enviar novamente.',
      true,
    );
  }

  if (!(error instanceof ApiError)) {
    return failure('generic', 'Algo inesperado aconteceu. Tente novamente.', false, true);
  }

  switch (error.status) {
    case 401:
      return failure('session-expired', 'Sua sessão expirou. Entre novamente para continuar.');
    case 403:
    case 404:
      return failure('unavailable', 'Este recurso não está disponível para a sua conta.');
    case 409:
      if (context === 'upload') {
        return failure(
          'duplicate',
          'Esta nota já foi processada anteriormente. Nada foi somado novamente; atualizamos o estoque e as sugestões.',
          true,
        );
      }
      if (/já decidida/i.test(error.message)) {
        return failure(
          'already-decided',
          'Esta sugestão já foi decidida, possivelmente em outra aba. Atualizamos a lista com o estado atual.',
          true,
        );
      }
      return failure('document', `${error.message}`, true);
    case 400:
    case 413:
    case 415:
      return failure('invalid', error.message, false, true);
    case 422:
      return failure('document', `${error.message} Nenhuma alteração foi aplicada ao estoque.`);
    case 429:
      return failure(
        'rate-limit',
        error.retryAfterSeconds !== undefined
          ? `Muitas solicitações em pouco tempo. Aguarde ${error.retryAfterSeconds} segundos e tente novamente.`
          : 'Muitas solicitações em pouco tempo. Aguarde um pouco e tente novamente.',
        false,
        true,
      );
    case 502:
    case 503:
    case 504:
      return failure(
        'provider-unavailable',
        `${error.message} Você pode tentar novamente manualmente mais tarde.`,
        false,
        true,
      );
    default:
      return failure('generic', 'Não foi possível concluir a operação. Tente novamente.', false, true);
  }
}
