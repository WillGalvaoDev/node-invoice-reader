import { describe, expect, it } from 'vitest';
import { createLogger, type LogEntry } from './logger.js';

describe('logger estruturado e redaction', () => {
  it('produz entrada previsível e preserva contexto não sensível', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({ sink: (entry) => entries.push(entry), now: () => new Date('2026-08-13T12:00:00Z') });

    logger.info('Operação concluída', { requestId: 'request-1', operation: 'safe-operation', count: 2 });

    expect(entries).toEqual([{
      level: 'info',
      message: 'Operação concluída',
      timestamp: '2026-08-13T12:00:00.000Z',
      requestId: 'request-1',
      context: { operation: 'safe-operation', count: 2 },
    }]);
  });

  it('redige chaves sensíveis sem distinção de caixa, inclusive em objetos aninhados', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({ sink: (entry) => entries.push(entry) });
    const sensitiveValues = [
      'plain-password', 'argon-hash', 'Bearer jwt-value', 'cookie-value', 'token-value',
      'access-value', 'refresh-value', 'jwt-value', 'api-key-value', 'gemini-key-value',
      'secret-value', 'jwt-secret-value', 'invite-camel-value', 'invite-snake-value', 'invite-kebab-value',
    ];

    logger.warn('Entrada protegida', {
      password: sensitiveValues[0],
      passwordHash: sensitiveValues[1],
      headers: { Authorization: sensitiveValues[2], COOKIE: sensitiveValues[3] },
      nested: {
        token: sensitiveValues[4], access_token: sensitiveValues[5], refreshToken: sensitiveValues[6],
        jwt: sensitiveValues[7], apiKey: sensitiveValues[8], GEMINI_API_KEY: sensitiveValues[9],
        secret: sensitiveValues[10], jwtSecret: sensitiveValues[11], safe: 'visible',
        inviteCode: sensitiveValues[12], invite_code: sensitiveValues[13], 'invite-code': sensitiveValues[14],
      },
    });

    const serialized = JSON.stringify(entries[0]);
    for (const value of sensitiveValues) expect(serialized).not.toContain(value);
    expect(serialized.match(/\[REDACTED\]/g)?.length).toBe(sensitiveValues.length);
    expect(entries[0]?.context).toMatchObject({ nested: { safe: 'visible' } });
  });
});

