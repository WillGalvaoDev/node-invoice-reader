import { AppError } from '../errors/app-error.js';
function validate(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success)
        throw new AppError('Dados inválidos.', 400);
    return result.data;
}
export function validateBody(schema) {
    return (request, _response, next) => {
        try {
            request.body = validate(schema, request.body);
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
export function validateQuery(schema) {
    return (request, _response, next) => {
        try {
            validate(schema, request.query);
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
export function validateParams(schema) {
    return (request, _response, next) => {
        try {
            request.params = validate(schema, request.params);
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=validate-request.js.map