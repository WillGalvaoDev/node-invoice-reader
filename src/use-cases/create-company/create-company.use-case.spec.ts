import { describe, beforeEach, it, expect } from 'vitest';
import { CreateCompanyUseCase } from './create-company.use-case.js';
import { InMemoryCompanyRepository } from '../../repositories/in-memory/in-memory-company.repository.js';
import { InMemoryStockRepository } from '../../repositories/in-memory/in-memory-stock.repository.js';
import { InMemoryAuditLogRepository } from '../../repositories/in-memory/in-memory-audit-log.repository.js';
import { AppError } from '../../errors/app-error.js';

describe('CreateCompanyUseCase', () => {
  let companyRepository: InMemoryCompanyRepository;
  let stockRepository: InMemoryStockRepository;
  let auditLogRepository: InMemoryAuditLogRepository;
  let sut: CreateCompanyUseCase;

  beforeEach(() => {
    companyRepository = new InMemoryCompanyRepository();
    stockRepository = new InMemoryStockRepository();
    auditLogRepository = new InMemoryAuditLogRepository();

    sut = new CreateCompanyUseCase(
      companyRepository,
      stockRepository,
      auditLogRepository
    );
  });

  it('deve ser possível criar uma empresa e gerar automaticamente o Estoque Principal', async () => {
    const response = await sut.execute({
      name: 'Empresa Exemplo LTDA',
      cnpj: '12345678000199',
      ownerId: 'user-1',
    });

    expect(response.company.id).toEqual(expect.any(String));
    expect(response.company.name).toBe('Empresa Exemplo LTDA');
    expect(response.company.cnpj).toBe('12345678000199');

    // Verifica se o estoque principal foi criado atrelado a essa empresa
    expect(response.defaultStock.id).toEqual(expect.any(String));
    expect(response.defaultStock.name).toBe('Estoque Principal');
    expect(response.defaultStock.companyId).toBe(response.company.id);

    // Verifica se o log de auditoria foi registrado
    expect(auditLogRepository.items).toHaveLength(1);
    expect(auditLogRepository.items[0]?.action).toBe('CREATE');
    expect(auditLogRepository.items[0]?.entity).toBe('COMPANY');
  });

  it('não deve ser possível criar uma empresa sem nome', async () => {
    await expect(() =>
      sut.execute({
        name: '',
        cnpj: '12345678000199',
        ownerId: 'user-1',
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('não deve ser possível criar uma empresa sem CNPJ', async () => {
    await expect(() =>
      sut.execute({
        name: 'Empresa Sem CNPJ',
        cnpj: '',
        ownerId: 'user-1',
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('não deve ser possível criar duas empresas com o mesmo CNPJ', async () => {
    const cnpj = '12345678000199';

    await sut.execute({
      name: 'Empresa Original',
      cnpj,
      ownerId: 'user-1',
    });

    await expect(() =>
      sut.execute({
        name: 'Empresa Duplicada',
        cnpj,
        ownerId: 'user-2',
      })
    ).rejects.toBeInstanceOf(AppError);
  });
});