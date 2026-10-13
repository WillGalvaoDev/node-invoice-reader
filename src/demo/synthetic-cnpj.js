import { randomBytes } from 'node:crypto';
import { computeCnpjCheckDigits } from '../domain/cnpj.js';
const BRANCH = '0001';
const SEED_BYTES = 8;
/**
 * CNPJ sintético matematicamente válido para fixtures. É dado de teste: o
 * algoritmo não consulta cadastros e não garante que o número jamais coincida
 * com o de uma empresa real. A unicidade no banco é tratada por quem persiste.
 */
export function generateSyntheticCnpj(seed = randomBytes(SEED_BYTES)) {
    if (seed.length < SEED_BYTES)
        throw new Error('Semente insuficiente para CNPJ sintético.');
    let root = '';
    for (let index = 0; index < 8; index++) {
        root += String((seed[index] ?? 0) % 10);
    }
    // Raiz repetida produziria CNPJ rejeitado pela validação; desloca o último dígito.
    if (/^(\d)\1{7}$/.test(root)) {
        root = `${root.slice(0, 7)}${(Number(root[7]) + 1) % 10}`;
    }
    const base = `${root}${BRANCH}`;
    return `${base}${computeCnpjCheckDigits(base)}`;
}
//# sourceMappingURL=synthetic-cnpj.js.map