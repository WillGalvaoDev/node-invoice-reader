import { describe, expect, it, vi } from 'vitest';
import { UploadInvoiceController } from './upload-invoice.controller.js';

describe('UploadInvoiceController MIME propagation', () => {
  it('propaga o MIME validado ao use case', async () => {
    const execute = vi.fn().mockResolvedValue({ extractedData: {}, processedProducts: [], suggestions: [] });
    const controller = new UploadInvoiceController({ execute } as any, { deleteFile: vi.fn() } as any);
    const request = {
      file: { path: 'tmp/hash-without-extension', mimetype: 'application/pdf' },
      body: { stockId: 'stock-1' },
      user: { id: 'user-1' },
    } as any;
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;

    await controller.handle(request, response);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'tmp/hash-without-extension',
      mimeType: 'application/pdf',
    }));
  });

  it('remove o temporario quando validacao posterior ao upload falha', async () => {
    const execute = vi.fn();
    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const controller = new UploadInvoiceController({ execute } as any, { deleteFile } as any);
    const request = {
      file: { path: 'tmp/uploaded-file', mimetype: 'image/png' },
      body: {},
      user: { id: 'user-1' },
    } as any;

    await expect(controller.handle(request, {} as any)).rejects.toMatchObject({ statusCode: 400 });

    expect(deleteFile).toHaveBeenCalledWith('tmp/uploaded-file');
    expect(execute).not.toHaveBeenCalled();
  });
});
