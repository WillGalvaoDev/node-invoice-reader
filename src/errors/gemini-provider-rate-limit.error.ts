import { AppError } from './app-error.js';

export const GEMINI_PROVIDER_RATE_LIMIT_MESSAGE =
  'O serviço de IA atingiu um limite temporário. Nenhuma alteração desta nota foi aplicada ao estoque. Tente novamente mais tarde.';

/** Recusa da dependência compartilhada, sem inferir duração ou dimensão da cota. */
export class GeminiProviderRateLimitError extends AppError {
  constructor() {
    super(GEMINI_PROVIDER_RATE_LIMIT_MESSAGE, 503);
    this.name = 'GeminiProviderRateLimitError';
  }
}
