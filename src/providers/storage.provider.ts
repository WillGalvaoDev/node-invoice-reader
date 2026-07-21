export interface IStorageProvider {
  readFile(path: string): Promise<string>;
  deleteFile(file: string): Promise<void>;
}