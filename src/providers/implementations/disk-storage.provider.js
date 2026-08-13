import {} from '../storage.provider.js';
import fs from 'node:fs/promises';
import path from 'node:path';
export class DiskStorageProvider {
    async readFile(path) {
        // Interacting with Libuv under the hood
        return await fs.readFile(path, 'utf-8');
    }
    async deleteFile(filePath) {
        const absolutePath = path.resolve(filePath);
        await fs.unlink(absolutePath);
    }
}
//# sourceMappingURL=disk-storage.provider.js.map