import type { RequestHandler } from 'express';
import multer from 'multer';
export declare const invoiceUpload: multer.Multer;
/** Upload de um único arquivo `file`, com validação do conteúdo antes do controller. */
export declare function invoiceFileUpload(): RequestHandler;
//# sourceMappingURL=invoice-upload.d.ts.map