import { type IStorageProvider } from '../storage.provider.js';
export declare class DiskStorageProvider implements IStorageProvider {
    readFile(path: string): Promise<string>;
    deleteFile(filePath: string): Promise<void>;
}
//# sourceMappingURL=disk-storage.provider.d.ts.map