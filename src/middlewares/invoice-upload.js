import multer from 'multer';
import { AppError } from '../errors/app-error.js';
import { isDanfeMimeType, MAX_DANFE_UPLOAD_SIZE_BYTES } from '../config/upload.js';
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
//# sourceMappingURL=invoice-upload.js.map