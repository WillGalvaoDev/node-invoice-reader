import { AppError } from '../../errors/app-error.js';
import { logger } from '../../infra/logger.js';
import { persistAuditBestEffort } from '../best-effort-audit.js';
import { auditEvents } from '../audit-events.js';
import { parseCnpj } from '../../domain/cnpj.js';
const DEFAULT_STOCK_NAME = 'Estoque Principal';
export class CreateCompanyUseCase {
    companyRepository;
    auditLogRepository;
    applicationLogger;
    constructor(companyRepository, auditLogRepository, applicationLogger = logger) {
        this.companyRepository = companyRepository;
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
        // 1. Cria a Empresa e o Estoque Principal em uma única transação atômica
        const { company, stock: defaultStock } = await this.companyRepository.createWithDefaultStock({ name, cnpj: canonicalCnpj, ownerId }, DEFAULT_STOCK_NAME);
        if (!company.id || !defaultStock.id) {
            throw new AppError('Erro ao criar a empresa.', 500);
        }
        // 2. Registra o Log de Auditoria
        await persistAuditBestEffort({
            repository: this.auditLogRepository,
            logger: this.applicationLogger,
            requestId,
            log: auditEvents.companyCreated({
                userId: ownerId,
                companyId: company.id,
                ...(defaultStock.id && { stockId: defaultStock.id }),
                defaultStockId: defaultStock.id ?? null,
            }),
        });
        return {
            company,
            defaultStock,
        };
    }
}
//# sourceMappingURL=create-company.use-case.js.map