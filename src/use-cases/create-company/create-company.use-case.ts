import type { ICompanyRepository, ICompany } from '../../repositories/company.repository.js';
import type { IStockRepository, IStock } from '../../repositories/stock.repository.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';
import { AppError } from '../../errors/app-error.js';
import { logger, type Logger } from '../../infra/logger.js';
import { persistAuditBestEffort } from '../best-effort-audit.js';

interface ICreateCompanyRequest {
  name: string;
  cnpj: string;
  ownerId: string;
  requestId?: string | undefined;
}

interface ICreateCompanyResponse {
  company: ICompany;
  defaultStock: IStock;
}

export class CreateCompanyUseCase {
  constructor(
    private readonly companyRepository: ICompanyRepository,
    private readonly stockRepository: IStockRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly applicationLogger: Logger = logger,
  ) {}

  async execute({ name, cnpj, ownerId, requestId }: ICreateCompanyRequest): Promise<ICreateCompanyResponse> {
    if (!name) {
      throw new AppError('O nome da empresa é obrigatório.', 400);
    }

    if (!cnpj) {
      throw new AppError('O CNPJ da empresa é obrigatório.', 400); // 👈 Validação de presença
    }

    const companyWithSameCnpj = await this.companyRepository.findByCnpj(cnpj);
    if (companyWithSameCnpj) {
      throw new AppError('Já existe uma empresa cadastrada com este CNPJ.', 409);
    }

    // 1. Cria a Empresa
    const company = await this.companyRepository.create({
      name,
      cnpj, // 👈 Agora o TS garante 100% que é uma string válida
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
        details: `Empresa "${company.name}" criada com Estoque Principal (ID: ${defaultStock.id}).`,
        userId: ownerId,
        companyId: company.id,
      },
    });

    return {
      company,
      defaultStock,
    };
  }
}
