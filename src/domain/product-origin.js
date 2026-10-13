import { AppError } from '../errors/app-error.js';
export const PRODUCT_ORIGIN_CONFLICT_MESSAGE = 'O código já existe neste estoque com fornecedor ou unidade incompatível. Nenhuma alteração foi aplicada.';
/** Espaços e caixa não distinguem unidades; "UN" e "CX" nunca são convertidas. */
export function normalizeUnitMeasurement(unit) {
    return unit.trim().replace(/\s+/g, ' ').toLowerCase();
}
export function isSameUnitMeasurement(left, right) {
    return normalizeUnitMeasurement(left) === normalizeUnitMeasurement(right);
}
export class ProductOriginConflictError extends AppError {
    constructor() {
        super(PRODUCT_ORIGIN_CONFLICT_MESSAGE, 422);
        this.name = 'ProductOriginConflictError';
    }
}
/**
 * Acúmulo automático por código exige origem comprovada igual e unidade igual.
 * Origem nula (registro legado) nunca é inferida: recusa em vez de somar.
 */
export function assertCompatibleProductEntry(existing, incoming) {
    const sameOrigin = existing.sourceSupplierCnpj != null && existing.sourceSupplierCnpj === incoming.supplierCnpj;
    if (!sameOrigin || !isSameUnitMeasurement(existing.unitMeasurement, incoming.unitMeasurement)) {
        throw new ProductOriginConflictError();
    }
}
//# sourceMappingURL=product-origin.js.map