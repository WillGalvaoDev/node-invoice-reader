import { DiskStorageProvider } from './providers/implementations/disk-storage.provider.js';
import { GeminiAiProvider } from './providers/gemini-ai.provider.js';
import { InMemoryProductRepository } from './repositories/in-memory-product.repository.js'; // Importe aqui
import { ReadInvoiceUseCase } from './use-cases/read-invoice/read-invoice.use-case.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  try {
    console.log('🚀 Inicializando o ecossistema DocScan...');

    // 1. Instanciamos os adaptadores reais de Infraestrutura
    const storageProvider = new DiskStorageProvider();
    const aiProvider = new GeminiAiProvider();
    const productRepository = new InMemoryProductRepository(); // Instancie aqui

    // 2. Injetamos os três provedores no Caso de Uso da Aplicação
    const readInvoiceUseCase = new ReadInvoiceUseCase(storageProvider, aiProvider, productRepository);


    // 3. Definimos o caminho do arquivo de teste (vamos criar este arquivo no próximo passo)
    const sampleFilePath = path.resolve(__dirname, '../nota.txt');

    console.log(`📂 Lendo e processando o arquivo fiscal: ${sampleFilePath}`);
    console.log('🤖 Enviando conteúdo para análise estruturada do Gemini...');
    
    // 4. Executamos a orquestração do pipeline
    const danfeData = await readInvoiceUseCase.execute(sampleFilePath);

    // 5. Exibimos o resultado consolidado e tipado na tela
    console.log('\n✅ DANFE Processado com Sucesso pelo Motor de IA!');
    console.log('==================================================');
    console.log(`Chave de Acesso: ${danfeData.accessKey}`);
    console.log(`Nota Nº: ${danfeData.invoiceNumber} | Série: ${danfeData.series}`);
    console.log(`Fornecedor: ${danfeData.supplier.name} (CNPJ: ${danfeData.supplier.cnpj})`);
    console.log(`Valor Total: R$ ${danfeData.totalValue.toFixed(2)}`);
    console.log('--------------------------------------------------');
    console.log('📦 Itens Extraídos para o Controle de Estoque:');
    
    danfeData.products.forEach((product, index) => {
      console.log(`  [${index + 1}] Código: ${product.code}`);
      console.log(`      Descrição: ${product.description}`);
      console.log(`      Qtd: ${product.quantity} ${product.unitMeasurement} | V. Unit: R$ ${product.unitPrice.toFixed(2)} | Total: R$ ${product.totalPrice.toFixed(2)}`);
    });
    console.log('==================================================');

  } catch (error: any) {
    console.error('\n❌ Falha Crítica no Pipeline do DANFE:');
    console.error(error.message);
  }
}

bootstrap();