import {} from '../storage.provider.js';
import fs from 'node:fs/promises';
import path from 'node:path';
export class DiskStorageProvider {
    async readFile(filePath) {
        return await fs.readFile(filePath);
    }
    async deleteFile(filePath) {
        const absolutePath = path.resolve(filePath);
        await fs.unlink(absolutePath);
    }
}
//# sourceMappingURL=disk-storage.provider.js.map