import { describe, beforeEach, it, expect, vi } from 'vitest';
import { CreateCompanyUseCase } from './create-company.use-case.js';
import { InMemoryCompanyRepository } from '../../repositories/in-memory/in-memory-company.repository.js';
import { InMemoryAuditLogRepository } from '../../repositories/in-memory/in-memory-audit-log.repository.js';
import { AppError } from '../../errors/app-error.js';

describe('CreateCompanyUseCase', () => {
  let companyRepository: InMemoryCompanyRepository;
  let auditLogRepository: InMemoryAuditLogRepository;
  let sut: CreateCompanyUseCase;

  beforeEach(() => {
    companyRepository = new InMemoryCompanyRepository();
    auditLogRepository = new InMemoryAuditLogRepository();

    sut = new CreateCompanyUseCase(
      companyRepository,
      auditLogRepository
    );
  });

  it('deve ser possível criar uma empresa e gerar automaticamente o Estoque Principal', async () => {
    const response = await sut.execute({
      name: 'Empresa Exemplo LTDA',
      cnpj: '11.222.333/0001-81',
      ownerId: 'user-1',
    });

    expect(response.company.id).toEqual(expect.any(String));
    expect(response.company.name).toBe('Empresa Exemplo LTDA');
    expect(response.company.cnpj).toBe('11222333000181');

    // Verifica se o estoque principal foi criado atrelado a essa empresa
    expect(response.defaultStock.id).toEqual(expect.any(String));
    expect(response.defaultStock.name).toBe('Estoque Principal');
    expect(response.defaultStock.companyId).toBe(response.company.id);

    // Verifica se o log de auditoria foi registrado
    expect(auditLogRepository.items).toHaveLength(1);
    expect(auditLogRepository.items[0]?.action).toBe('CREATE');
    expect(auditLogRepository.items[0]?.entity).toBe('COMPANY');
    expect(auditLogRepository.items[0]).toMatchObject({
      entityId: response.company.id,
      companyId: response.company.id,
      stockId: response.defaultStock.id,
      userId: 'user-1',
      description: 'Empresa criada com estoque principal.',
      previousState: null,
      newState: { companyId: response.company.id, defaultStockId: response.defaultStock.id },
    });
  });

  it('não deixa company órfã quando a criação do estoque padrão falha (unidade atômica)', async () => {
    companyRepository.failNextStockCreation = true;

    await expect(sut.execute({ name: 'Empresa Órfã', cnpj: '11222333000181', ownerId: 'user-1' }))
      .rejects.toThrow('Simulated stock creation failure');

    expect(companyRepository.items).toHaveLength(0);
    expect(companyRepository.stocks).toHaveLength(0);
    expect(await companyRepository.findByCnpj('11222333000181')).toBeNull();
    expect(auditLogRepository.items).toHaveLength(0);
  });

  it('não deve ser possível criar uma empresa sem nome', async () => {
    await expect(() =>
      sut.execute({
        name: '',
        cnpj: '11222333000181',
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
    const cnpj = '11222333000181';

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

  it('trata formatos e casing equivalentes como a mesma identidade', async () => {
    await sut.execute({ name: 'Original', cnpj: '12.ABC.345/01DE-35', ownerId: 'user-1' });

    await expect(sut.execute({ name: 'Duplicada', cnpj: '12abc34501de35', ownerId: 'user-2' }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(companyRepository.items).toHaveLength(1);
    expect(companyRepository.items[0]?.cnpj).toBe('12ABC34501DE35');
  });

  it('rejeita CNPJ com DV inválido antes do repository', async () => {
    const findByCnpj = vi.spyOn(companyRepository, 'findByCnpj');

    await expect(sut.execute({ name: 'Inválida', cnpj: '12.ABC.345/01DE-34', ownerId: 'user-1' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(findByCnpj).not.toHaveBeenCalled();
    expect(companyRepository.items).toHaveLength(0);
  });

  it('mantém company e stock criados quando o audit falha e registra somente contexto seguro', async () => {
    const failingAudit = {
      create: vi.fn().mockRejectedValue(new Error('database details')),
      findByCompanyId: vi.fn(),
      findByUserId: vi.fn(),
    };
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const useCase = new CreateCompanyUseCase(companyRepository, failingAudit, logger);

    const result = await useCase.execute({
      name: 'Empresa Audit Isolado', cnpj: '04252011000110', ownerId: 'user-1', requestId: 'company-request',
    });

    expect(result.company.id).toBeDefined();
    expect(result.defaultStock.companyId).toBe(result.company.id);
    expect(logger.error).toHaveBeenCalledWith('Failed to persist audit log', {
      requestId: 'company-request', action: 'CREATE', entity: 'COMPANY', error: { name: 'Error' },
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('database details');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('04252011000110');
  });
});
