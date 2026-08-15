import { type IStorageProvider } from '../storage.provider.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export class DiskStorageProvider implements IStorageProvider {
  async readFile(filePath: string): Promise<Buffer> {
    return await fs.readFile(filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    await fs.unlink(absolutePath);
  }
}
