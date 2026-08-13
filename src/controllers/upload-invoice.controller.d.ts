import type { Request, Response } from 'express';
import { ReadInvoiceUseCase } from '../use-cases/read-invoice/read-invoice.use-case.js';
import type { IStorageProvider } from '../providers/storage.provider.js';
export declare class UploadInvoiceController {
    private readInvoiceUseCase;
    private storageProvider;
    constructor(readInvoiceUseCase: ReadInvoiceUseCase, storageProvider: IStorageProvider);
    handle(request: Request, response: Response): Promise<Response>;
}
//# sourceMappingURL=upload-invoice.controller.d.ts.map