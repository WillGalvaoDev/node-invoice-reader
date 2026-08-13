import type { Request, Response } from 'express';
import type { ListProductsUseCase } from '../use-cases/list-products/list-products.use-case.ts';
export declare class ListProductsController {
    private listProductsUseCase;
    constructor(listProductsUseCase: ListProductsUseCase);
    handle(request: Request, response: Response): Promise<Response>;
}
//# sourceMappingURL=list-products.controller.d.ts.map