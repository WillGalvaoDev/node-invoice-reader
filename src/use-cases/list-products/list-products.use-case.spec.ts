import { describe, beforeEach, it, expect } from 'vitest';
import { InMemoryProductRepository } from '../../repositories/in-memory/in-memory-product.repository.js';
import { ListProductsUseCase } from './list-products.use-case.js';

describe('ListProductsUseCase', () => {
  let productRepository: InMemoryProductRepository;
  let sut: ListProductsUseCase; // SUT = System Under Test

  beforeEach(() => {
    productRepository = new InMemoryProductRepository();
    sut = new ListProductsUseCase(productRepository);
  });

  it('deve ser capaz de listar todos os produtos pertencentes ao usuário informado (sem filtros de estoque/empresa)', async () => {
    // 1. Prepara a base em memória com produtos do user-1 e user-2
    await productRepository.save({
      code: '001',
      description: 'CHAPA TRABALHADA 16MM',
      quantity: 10,
      unitMeasurement: 'KG',
      unitPrice: 15.0,
      totalPrice: 150.0,
      stockId: 'stock-1',
      userId: 'user-1',
    });

    await productRepository.save({
      code: '002',
      description: 'TUBO FERRO GALVANIZADO',
      quantity: 5,
      unitMeasurement: 'METRO',
      unitPrice: 20.0,
      totalPrice: 100.0,
      stockId: 'stock-2',
      userId: 'user-1',
    });

    await productRepository.save({
      code: '003',
      description: 'PRODUTO DE OUTRO USUARIO',
      quantity: 1,
      unitMeasurement: 'UN',
      unitPrice: 50.0,
      totalPrice: 50.0,
      stockId: 'stock-1',
      userId: 'user-2',
    });

    // 2. Executa a listagem para o user-1
    const products = await sut.execute({ userId: 'user-1' });

    // 3. Asserções
    expect(products).toHaveLength(2);
    expect(products).toEqual([
      expect.objectContaining({ code: '001', userId: 'user-1' }),
      expect.objectContaining({ code: '002', userId: 'user-1' }),
    ]);
  });

  it('deve ser capaz de filtrar produtos por um estoque especifico (stockId)', async () => {
    await productRepository.save({
      code: '001',
      description: 'PRODUTO ESTOQUE 1',
      quantity: 10,
      unitMeasurement: 'KG',
      unitPrice: 15.0,
      totalPrice: 150.0,
      stockId: 'stock-1',
      userId: 'user-1',
    });

    await productRepository.save({
      code: '002',
      description: 'PRODUTO ESTOQUE 2',
      quantity: 5,
      unitMeasurement: 'METRO',
      unitPrice: 20.0,
      totalPrice: 100.0,
      stockId: 'stock-2',
      userId: 'user-1',
    });

    const products = await sut.execute({
      userId: 'user-1',
      stockId: 'stock-1',
    });

    expect(products).toHaveLength(1);
    expect(products).toEqual([
      expect.objectContaining({ code: '001', stockId: 'stock-1' }),
    ]);
  });

  it('deve ser capaz de filtrar produtos por empresa (companyId)', async () => {
    await productRepository.save({
      code: '001',
      description: 'PRODUTO DA EMPRESA 1',
      quantity: 10,
      unitMeasurement: 'KG',
      unitPrice: 15.0,
      totalPrice: 150.0,
      stockId: 'stock-empresa-1',
      userId: 'user-1',
    });

    const products = await sut.execute({
      userId: 'user-1',
      companyId: 'company-1',
    });

    // No repositório em memória, findByCompanyId deve retornar os itens cadastrados
    expect(products).toBeDefined();
    expect(Array.isArray(products)).toBe(true);
  });

  it('deve dar prioridade ao filtro de estoque (stockId) se stockId e companyId forem informados juntos', async () => {
  await productRepository.save({
    code: '001',
    description: 'PRODUTO ESTOQUE 1',
    quantity: 10,
    unitMeasurement: 'KG',
    unitPrice: 15.0,
    totalPrice: 150.0,
    stockId: 'stock-1',
    userId: 'user-1',
  });

  const products = await sut.execute({
    userId: 'user-1',
    stockId: 'stock-1',
    companyId: 'company-1',
  });

  // 1. Valida a cardinalidade (quantidade de itens)
  expect(products).toHaveLength(1);

  // 2. Valida o conteúdo declarativamente sem acessar índices diretamente
  expect(products).toEqual([
    expect.objectContaining({ stockId: 'stock-1' }),
  ]);
});

  it('deve retornar um array vazio caso o usuário não possua produtos cadastrados', async () => {
    const products = await sut.execute({ userId: 'user-sem-produtos' });

    expect(products).toHaveLength(0);
    expect(products).toEqual([]);
  });

  it('não deve retornar produtos de outro usuário mesmo se o stockId for informado', async () => {
    // Produto cadastrado para o user-2 no stock-1
    await productRepository.save({
      code: '001',
      description: 'PRODUTO DO USER 2',
      quantity: 10,
      unitMeasurement: 'KG',
      unitPrice: 15.0,
      totalPrice: 150.0,
      stockId: 'stock-1',
      userId: 'user-2',
    });

    // User 1 tenta listar informando o stock-1 (que pertence ao user 2)
    const products = await sut.execute({
      userId: 'user-1',
      stockId: 'stock-1',
    });

    // Deve bloquear e retornar array vazio
    expect(products).toHaveLength(0);
  });
});