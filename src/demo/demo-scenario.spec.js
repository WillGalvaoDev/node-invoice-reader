import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnpj } from '../domain/cnpj.js';
import { buildDemoInvoice, DEMO_DOCUMENT_KINDS, DEMO_SCENARIO, deriveDemoAccessKey, } from './demo-scenario.js';
import { generateSyntheticCnpj } from './synthetic-cnpj.js';
describe('cenário embutido', () => {
    it('permanece idêntico à fixture versionada em examples/demo/scenario.json', () => {
        const fixture = JSON.parse(readFileSync('examples/demo/scenario.json', 'utf8'));
        expect(JSON.parse(JSON.stringify(DEMO_SCENARIO))).toEqual(fixture);
    });
});
describe('chaves de acesso por sessão', () => {
    it('reproduz o algoritmo do gerador Python (paridade com generate-demo-pdfs.py)', () => {
        // Valores gerados por scripts/generate-demo-pdfs.py::load_scenario('visitor-a').
        expect(deriveDemoAccessKey('visitor-a', 'initial')).toBe('04315906560911562789526892086587885800003529');
        expect(deriveDemoAccessKey('visitor-a', 'followup')).toBe('95940505900737345609540379551228761722348820');
    });
    it('é determinística, tem 44 dígitos e difere por sessão e por documento', () => {
        const keys = new Set();
        for (const sessionId of ['s1', 's2']) {
            for (const kind of DEMO_DOCUMENT_KINDS) {
                const key = deriveDemoAccessKey(sessionId, kind);
                expect(key).toMatch(/^\d{44}$/);
                expect(deriveDemoAccessKey(sessionId, kind)).toBe(key);
                keys.add(key);
            }
        }
        expect(keys.size).toBe(4);
    });
    it('mantém itens e totais das fixtures e troca somente a chave', () => {
        for (const kind of DEMO_DOCUMENT_KINDS) {
            const invoice = buildDemoInvoice(kind, 'session-x');
            expect(invoice.products).toEqual(DEMO_SCENARIO[kind].products);
            expect(invoice.totalValue).toBe(DEMO_SCENARIO[kind].totalValue);
            expect(invoice.accessKey).toBe(deriveDemoAccessKey('session-x', kind));
            expect(invoice.accessKey).not.toBe(DEMO_SCENARIO[kind].accessKey);
        }
    });
});
describe('generateSyntheticCnpj', () => {
    it('produz CNPJ matematicamente válido, filial 0001, de forma determinística por semente', () => {
        const seed = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        const cnpj = generateSyntheticCnpj(seed);
        expect(cnpj).toMatch(/^\d{14}$/);
        expect(parseCnpj(cnpj)).toBe(cnpj);
        expect(cnpj.slice(8, 12)).toBe('0001');
        expect(generateSyntheticCnpj(seed)).toBe(cnpj);
    });
    it('gera valores válidos e distintos para sementes aleatórias, sem repetir dígitos', () => {
        const values = new Set();
        for (let index = 0; index < 50; index++) {
            const cnpj = generateSyntheticCnpj();
            expect(parseCnpj(cnpj)).toBe(cnpj);
            expect(cnpj).not.toMatch(/^(\d)\1{13}$/);
            values.add(cnpj);
        }
        expect(values.size).toBe(50);
    });
});
//# sourceMappingURL=demo-scenario.spec.js.map