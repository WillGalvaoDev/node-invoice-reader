import { AppError } from '../errors/app-error.js';
export declare const PRODUCT_ORIGIN_CONFLICT_MESSAGE = "O c\u00F3digo j\u00E1 existe neste estoque com fornecedor ou unidade incompat\u00EDvel. Nenhuma altera\u00E7\u00E3o foi aplicada.";
/** Espaços e caixa não distinguem unidades; "UN" e "CX" nunca são convertidas. */
export declare function normalizeUnitMeasurement(unit: string): string;
export declare function isSameUnitMeasurement(left: string, right: string): boolean;
export declare class ProductOriginConflictError extends AppError {
    constructor();
}
/**
 * Acúmulo automático por código exige origem comprovada igual e unidade igual.
 * Origem nula (registro legado) nunca é inferida: recusa em vez de somar.
 */
export declare function assertCompatibleProductEntry(existing: {
    sourceSupplierCnpj?: string | null;
    unitMeasurement: string;
}, incoming: {
    supplierCnpj: string;
    unitMeasurement: string;
}): void;
//# sourceMappingURL=product-origin.d.ts.map