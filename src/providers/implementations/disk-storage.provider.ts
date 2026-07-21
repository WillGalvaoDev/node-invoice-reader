import { type IStorageProvider } from '../storage.provider.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export class DiskStorageProvider implements IStorageProvider {
  async readFile(path: string): Promise<string> {
    // Interacting with Libuv under the hood
    return await fs.readFile(path, 'utf-8');
  }

  async deleteFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    await fs.unlink(absolutePath);
  }
}