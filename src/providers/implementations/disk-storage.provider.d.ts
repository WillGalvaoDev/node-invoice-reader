import { type IStorageProvider } from '../storage.provider.js';
export declare class DiskStorageProvider implements IStorageProvider {
    readFile(filePath: string): Promise<Buffer>;
    deleteFile(filePath: string): Promise<void>;
}
//# sourceMappingURL=disk-storage.provider.d.ts.map