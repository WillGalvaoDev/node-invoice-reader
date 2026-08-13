export class AppError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AppError';
        Error.captureStackTrace?.(this, AppError);
    }
}
//# sourceMappingURL=app-error.js.map