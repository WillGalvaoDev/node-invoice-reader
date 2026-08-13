import { AppError } from '../../errors/app-error.js';
import { logger } from '../../infra/logger.js';
import { persistAuditBestEffort } from '../best-effort-audit.js';
import { parseCnpj } from '../../domain/cnpj.js';
export class CreateCompanyUseCase {
    companyRepository;
    stockRepository;
    auditLogRepository;
    applicationLogger;
    constructor(companyRepository, stockRepository, auditLogRepository, applicationLogger = logger) {
        this.companyRepository = companyRepository;
        this.stockRepository = stockRepository;
        this.auditLogRepository = auditLogRepository;
        this.applicationLogger = applicationLogger;
    }
    async execute({ name, cnpj, ownerId, requestId }) {
        if (!name) {
            throw new AppError('O nome da empresa é obrigatório.', 400);
        }
        let canonicalCnpj;
        try {
            canonicalCnpj = parseCnpj(cnpj);
        }
        catch {
            throw new AppError('CNPJ inválido.', 400);
        }
        const companyWithSameCnpj = await this.companyRepository.findByCnpj(canonicalCnpj);
        if (companyWithSameCnpj) {
            throw new AppError('Já existe uma empresa cadastrada com este CNPJ.', 409);
        }
        // 1. Cria a Empresa
        const company = await this.companyRepository.create({
            name,
            cnpj: canonicalCnpj,
            ownerId,
        });
        if (!company.id) {
            throw new AppError('Erro ao criar a empresa.', 500);
        }
        // 2. Cria automaticamente o Estoque Principal vinculado à Empresa
        const defaultStock = await this.stockRepository.create({
            name: 'Estoque Principal',
            companyId: company.id,
        });
        // 3. Registra o Log de Auditoria
        await persistAuditBestEffort({
            repository: this.auditLogRepository,
            logger: this.applicationLogger,
            requestId,
            log: {
                action: 'CREATE',
                entity: 'COMPANY',
                entityId: company.id,
                description: 'Empresa criada com estoque principal.',
                userId: ownerId,
                companyId: company.id,
                ...(defaultStock.id && { stockId: defaultStock.id }),
                previousState: null,
                newState: { companyId: company.id, defaultStockId: defaultStock.id ?? null },
            },
        });
        return {
            company,
            defaultStock,
        };
    }
}
//# sourceMappingURL=create-company.use-case.js.map