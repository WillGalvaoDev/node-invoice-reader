export interface IStorageProvider {
  readFile(path: string): Promise<string>;
}