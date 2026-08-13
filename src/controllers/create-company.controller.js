import { AppError } from '../errors/app-error.js';
export class CreateCompanyController {
    createCompanyUseCase;
    constructor(createCompanyUseCase) {
        this.createCompanyUseCase = createCompanyUseCase;
    }
    async handle(request, response) {
        const ownerId = request.user?.id;
        if (!ownerId) {
            throw new AppError('Usuário não autenticado.', 401);
        }
        const { name, cnpj } = request.body;
        const result = await this.createCompanyUseCase.execute({
            name,
            cnpj,
            ownerId,
            requestId: request.requestId,
        });
        return response.status(201).json({
            status: 'success',
            data: result,
        });
    }
}
//# sourceMappingURL=create-company.controller.js.map