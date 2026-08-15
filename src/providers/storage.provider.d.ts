export interface IStorageProvider {
    readFile(path: string): Promise<Buffer>;
    deleteFile(file: string): Promise<void>;
}
//# sourceMappingURL=storage.provider.d.ts.map