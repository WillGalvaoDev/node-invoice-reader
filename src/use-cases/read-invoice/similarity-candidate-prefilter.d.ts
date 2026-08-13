import type { IProduct } from '../../repositories/product.repository.js';
export declare const MAX_SIMILARITY_CANDIDATES = 15;
export declare function normalizeSimilarityText(value: string): string;
export declare function prefilterSimilarityCandidates(description: string, stockId: string, catalog: IProduct[]): IProduct[];
//# sourceMappingURL=similarity-candidate-prefilter.d.ts.map