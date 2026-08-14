export declare const MAX_DANFE_UPLOAD_SIZE_BYTES: number;
export declare const SUPPORTED_DANFE_MIME_TYPES: readonly ["image/jpeg", "image/png", "application/pdf"];
export type DanfeMimeType = typeof SUPPORTED_DANFE_MIME_TYPES[number];
export declare function isDanfeMimeType(value: string): value is DanfeMimeType;
//# sourceMappingURL=upload.d.ts.map