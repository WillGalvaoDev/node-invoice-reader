const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL deve estar explicitamente configurada para testes PostgreSQL.');
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(testDatabaseUrl);
} catch {
  throw new Error('TEST_DATABASE_URL não é uma URL válida.');
}

if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
  throw new Error('TEST_DATABASE_URL deve apontar para PostgreSQL.');
}

const databaseName = parsedUrl.pathname.slice(1).toLowerCase();
if (!databaseName.includes('test')) {
  throw new Error('TEST_DATABASE_URL recusada: o nome do banco deve identificá-lo inequivocamente como teste.');
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET ||= 'integration-test-jwt-secret-32-chars-min';
process.env.GEMINI_API_KEY ||= 'integration-test-gemini-key';

