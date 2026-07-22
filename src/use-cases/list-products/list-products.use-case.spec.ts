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

  it('deve ser capaz de listar produtos pertencentes apenas ao usuário informado', async () => {
    // 1. Prepara a base em memória com produtos do user-1 e user-2
    await productRepository.save({
      code: '001',
      description: 'CHAPA TRABALHADA 16MM',
      quantity: 10,
      unitMeasurement: 'KG',
      unitPrice: 15.0,
      totalPrice: 150.0,
      userId: 'user-1',
    });

    await productRepository.save({
      code: '002',
      description: 'TUBO FERRO GALVANIZADO',
      quantity: 5,
      unitMeasurement: 'METRO',
      unitPrice: 20.0,
      totalPrice: 100.0,
      userId: 'user-1',
    });

    await productRepository.save({
      code: '003',
      description: 'PRODUTO DE OUTRO USUARIO',
      quantity: 1,
      unitMeasurement: 'UN',
      unitPrice: 50.0,
      totalPrice: 50.0,
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

  it('deve retornar um array vazio caso o usuário não possua produtos cadastrados', async () => {
    const products = await sut.execute({ userId: 'user-sem-produtos' });

    expect(products).toHaveLength(0);
    expect(products).toEqual([]);
  });
});