export function isPrismaErrorCode(error, code) {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === code;
}
//# sourceMappingURL=prisma-error.js.map