import { AppError } from '../errors/app-error.js';
import { listCompaniesQuerySchema } from '../schemas/http.schemas.js';
export class ListCompaniesController {
    listCompaniesUseCase;
    constructor(listCompaniesUseCase) {
        this.listCompaniesUseCase = listCompaniesUseCase;
    }
    async handle(request, response) {
        const userId = request.user?.id;
        if (!userId) {
            throw new AppError('Usuário não autenticado.', 401);
        }
        const { limit, cursor } = listCompaniesQuerySchema.parse(request.query);
        const page = await this.listCompaniesUseCase.execute({ userId, limit, cursor });
        return response.status(200).json({
            status: 'success',
            data: {
                items: page.items,
                nextCursor: page.nextCursor,
            },
        });
    }
}
//# sourceMappingURL=list-companies.controller.js.map