import { open, unlink } from 'node:fs/promises';
import type { Request, RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error.js';
import {
  isDanfeMimeType, matchesDanfeSignature, MAX_DANFE_SIGNATURE_BYTES, MAX_DANFE_UPLOAD_SIZE_BYTES,
} from '../config/upload.js';

export const invoiceUpload = multer({
  dest: 'tmp/',
  limits: {
    fileSize: MAX_DANFE_UPLOAD_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!isDanfeMimeType(file.mimetype)) {
      callback(new AppError('Tipo de arquivo não suportado.', 415));
      return;
    }

    callback(null, true);
  },
});

async function readHeader(path: string): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const header = Buffer.alloc(MAX_DANFE_SIGNATURE_BYTES);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return header.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** O MIME vem do cliente: confere a assinatura do conteúdo e remove o temporário se divergir. */
async function assertUploadedContentMatchesMime(request: Request): Promise<void> {
  const file = request.file;
  if (!file) return;

  const header = await readHeader(file.path);
  if (isDanfeMimeType(file.mimetype) && matchesDanfeSignature(file.mimetype, header)) return;

  await unlink(file.path).catch(() => undefined);
  throw new AppError('Conteúdo do arquivo não corresponde ao tipo informado.', 415);
}

/** Upload de um único arquivo `file`, com validação do conteúdo antes do controller. */
export function invoiceFileUpload(): RequestHandler {
  const single = invoiceUpload.single('file');

  return (request, response, next) => {
    single(request, response, (uploadError?: unknown) => {
      if (uploadError) {
        next(uploadError);
        return;
      }
      assertUploadedContentMatchesMime(request).then(() => next(), next);
    });
  };
}
