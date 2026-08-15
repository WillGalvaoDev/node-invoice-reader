import { AppError } from '../errors/app-error.js';
import { listCompanyStocksQuerySchema } from '../schemas/http.schemas.js';
export class ListCompanyStocksController {
    listCompanyStocksUseCase;
    constructor(listCompanyStocksUseCase) {
        this.listCompanyStocksUseCase = listCompanyStocksUseCase;
    }
    async handle(request, response) {
        const userId = request.user?.id;
        if (!userId) {
            throw new AppError('Usuário não autenticado.', 401);
        }
        const { companyId } = request.params;
        const { limit, cursor } = listCompanyStocksQuerySchema.parse(request.query);
        const page = await this.listCompanyStocksUseCase.execute({
            userId,
            companyId,
            limit,
            cursor,
            requestId: request.requestId,
        });
        return response.status(200).json({
            status: 'success',
            data: {
                items: page.items,
                nextCursor: page.nextCursor,
            },
        });
    }
}
//# sourceMappingURL=list-company-stocks.controller.js.map