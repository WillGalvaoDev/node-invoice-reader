import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DiskStorageProvider } from './providers/implementations/disk-storage.provider.js';
import { ReadInvoiceUseCase } from './use-cases/read-invoice/read-invoice.use-case.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  // 1. Instanciamos a ferramenta real (Disco Rígido)
  const diskStorageProvider = new DiskStorageProvider();
  
  // 2. Injetamos a ferramenta dentro do Caso de Uso
  const readInvoiceUseCase = new ReadInvoiceUseCase(diskStorageProvider);
  
  try {
    const invoicePath = path.resolve(__dirname, '../nota.txt');
    
    // 3. Executamos a nossa ação de negócio
    const invoiceContent = await readInvoiceUseCase.execute(invoicePath);
    
    console.log("🚀 Invoice data processed successfully:");
    console.log(invoiceContent);
  } catch (error) {
    console.error("❌ Process failed:", error);
  }
}

bootstrap();