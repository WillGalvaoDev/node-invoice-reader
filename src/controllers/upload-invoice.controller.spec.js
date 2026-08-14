import { describe, expect, it, vi } from 'vitest';
import { UploadInvoiceController } from './upload-invoice.controller.js';
describe('UploadInvoiceController MIME propagation', () => {
    it('propaga o MIME validado ao use case', async () => {
        const execute = vi.fn().mockResolvedValue({ extractedData: {}, processedProducts: [], suggestions: [] });
        const controller = new UploadInvoiceController({ execute }, { deleteFile: vi.fn() });
        const request = {
            file: { path: 'tmp/hash-without-extension', mimetype: 'application/pdf' },
            body: { stockId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
            user: { id: 'user-1' },
        };
        const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
        await controller.handle(request, response);
        expect(execute).toHaveBeenCalledWith(expect.objectContaining({
            filePath: 'tmp/hash-without-extension',
            mimeType: 'application/pdf',
        }));
    });
    it('remove o temporario quando validacao posterior ao upload falha', async () => {
        const execute = vi.fn();
        const deleteFile = vi.fn().mockResolvedValue(undefined);
        const controller = new UploadInvoiceController({ execute }, { deleteFile });
        const request = {
            file: { path: 'tmp/uploaded-file', mimetype: 'image/png' },
            body: {},
            user: { id: 'user-1' },
        };
        await expect(controller.handle(request, {})).rejects.toMatchObject({ statusCode: 400 });
        expect(deleteFile).toHaveBeenCalledWith('tmp/uploaded-file');
        expect(execute).not.toHaveBeenCalled();
    });
    it('rejeita body multipart com stockId de tipo inválido antes do use case e remove o arquivo', async () => {
        const execute = vi.fn().mockResolvedValue({ extractedData: {}, processedProducts: [], suggestions: [] });
        const deleteFile = vi.fn().mockResolvedValue(undefined);
        const controller = new UploadInvoiceController({ execute }, { deleteFile });
        const request = {
            file: { path: 'tmp/uploaded-file', mimetype: 'image/png' },
            body: { stockId: { injected: true } },
            user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
            requestId: 'upload-validation',
        };
        await expect(controller.handle(request, {})).rejects.toMatchObject({ statusCode: 400 });
        expect(execute).not.toHaveBeenCalled();
        expect(deleteFile).toHaveBeenCalledWith('tmp/uploaded-file');
    });
    it('rejeita companyId redundante no upload em vez de confiar no tenant do cliente', async () => {
        const execute = vi.fn();
        const deleteFile = vi.fn().mockResolvedValue(undefined);
        const controller = new UploadInvoiceController({ execute }, { deleteFile });
        const request = {
            file: { path: 'tmp/uploaded-file', mimetype: 'image/png' },
            body: {
                stockId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            },
            user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        };
        await expect(controller.handle(request, {})).rejects.toMatchObject({ statusCode: 400 });
        expect(execute).not.toHaveBeenCalled();
        expect(deleteFile).toHaveBeenCalledWith('tmp/uploaded-file');
    });
});
//# sourceMappingURL=upload-invoice.controller.spec.js.map