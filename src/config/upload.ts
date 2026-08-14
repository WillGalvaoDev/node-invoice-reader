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
