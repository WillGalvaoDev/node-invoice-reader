import { AppError } from '../errors/app-error.js';
import { listProductsQuerySchema } from '../schemas/http.schemas.js';
export class ListProductsController {
    listProductsUseCase;
    constructor(listProductsUseCase) {
        this.listProductsUseCase = listProductsUseCase;
    }
    async handle(request, response) {
        const userId = request.user?.id;
        if (!userId) {
            throw new AppError('Usuário não autenticado.', 401);
        }
        const { stockId, limit, cursor } = listProductsQuerySchema.parse(request.query);
        const page = await this.listProductsUseCase.execute({ userId, stockId, limit, cursor });
        return response.status(200).json({
            status: 'success',
            data: {
                items: page.items,
                nextCursor: page.nextCursor,
            },
        });
    }
}
//# sourceMappingURL=list-products.controller.js.map