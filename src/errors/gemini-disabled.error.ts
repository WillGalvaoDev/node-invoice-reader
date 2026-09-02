import { AppError } from './app-error.js';

export const GEMINI_DISABLED_MESSAGE = 'O serviço de IA está desabilitado pelo operador no momento.';

/**
 * Estado B do kill switch (P4-02): `GEMINI_ENABLED=false`. Distinto de esgotamento de cota
 * (estado C) — não há `Retry-After`, porque não há previsão de retorno; é decisão humana,
 * não janela de tempo.
 */
export class GeminiDisabledError extends AppError {
  constructor() {
    super(GEMINI_DISABLED_MESSAGE, 503);
    this.name = 'GeminiDisabledError';
  }
}
