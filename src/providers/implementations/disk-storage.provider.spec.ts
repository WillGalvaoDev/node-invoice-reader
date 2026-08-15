import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { DiskStorageProvider } from './disk-storage.provider.js';

describe('DiskStorageProvider', () => {
  const sut = new DiskStorageProvider();
  const createdFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(createdFiles.splice(0).map((file) => fs.rm(file, { force: true })));
  });

  it('lê o conteúdo do arquivo como bytes (Buffer), sem corromper dados binários', async () => {
    const filePath = path.join(tmpdir(), `docscan-storage-${randomUUID()}.bin`);
    createdFiles.push(filePath);
    // Bytes fora do intervalo ASCII/UTF-8 válido corrompem sob decodificação 'utf-8' — prova que
    // a leitura é binary-safe (a interface antiga declarava Promise<string> e nunca era chamada).
    const binaryContent = Buffer.from([0x00, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47]);
    await fs.writeFile(filePath, binaryContent);

    const result = await sut.readFile(filePath);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.equals(binaryContent)).toBe(true);
  });

  it('remove o arquivo do disco', async () => {
    const filePath = path.join(tmpdir(), `docscan-storage-${randomUUID()}.tmp`);
    await fs.writeFile(filePath, 'conteudo');

    await sut.deleteFile(filePath);

    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('não usa leitura síncrona (fs/promises apenas)', async () => {
    const source = await fs.readFile(new URL('./disk-storage.provider.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('readFileSync');
    expect(source).not.toContain("from 'node:fs'");
  });
});
