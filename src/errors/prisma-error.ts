export type PrismaConstraintErrorCode = 'P2002' | 'P2003';

export function isPrismaErrorCode(
  error: unknown,
  code: PrismaConstraintErrorCode,
): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === code;
}
