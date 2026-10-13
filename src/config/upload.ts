export const MAX_DANFE_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export const SUPPORTED_DANFE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export type DanfeMimeType = typeof SUPPORTED_DANFE_MIME_TYPES[number];

export function isDanfeMimeType(value: string): value is DanfeMimeType {
  return SUPPORTED_DANFE_MIME_TYPES.some((mimeType) => mimeType === value);
}

const FILE_SIGNATURES: Record<DanfeMimeType, readonly (readonly number[])[]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46, 0x2d]],
};

export const MAX_DANFE_SIGNATURE_BYTES = 8;

/** Confere os primeiros bytes com o tipo declarado; não prova que o arquivo é legível. */
export function matchesDanfeSignature(mimeType: DanfeMimeType, header: Uint8Array): boolean {
  return FILE_SIGNATURES[mimeType].some((signature) =>
    header.length >= signature.length && signature.every((byte, index) => header[index] === byte));
}
