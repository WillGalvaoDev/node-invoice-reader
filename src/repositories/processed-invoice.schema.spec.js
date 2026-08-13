import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
describe('ProcessedInvoice schema and migration', () => {
    it('define identidade globalmente unica para a chave de acesso', () => {
        const schema = fs.readFileSync(path.resolve('prisma/schema.prisma'), 'utf8');
        expect(schema).toMatch(/model ProcessedInvoice[\s\S]*accessKey\s+String\s+@unique/);
    });
    it('adiciona a constraint unique em uma nova migration', () => {
        const migrationsPath = path.resolve('prisma/migrations');
        const migration = fs.readdirSync(migrationsPath)
            .filter((entry) => entry.includes('processed_invoice'))
            .map((entry) => fs.readFileSync(path.join(migrationsPath, entry, 'migration.sql'), 'utf8'))
            .join('\n');
        expect(migration).toMatch(/CREATE TABLE "processed_invoices"/);
        expect(migration).toMatch(/CREATE UNIQUE INDEX [\s\S]*\("accessKey"\)/);
    });
});
//# sourceMappingURL=processed-invoice.schema.spec.js.map