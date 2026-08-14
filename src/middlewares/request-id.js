import { randomUUID } from 'node:crypto';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
export function requestIdMiddleware(request, response, next) {
    const suppliedRequestId = request.get('x-request-id');
    request.requestId = suppliedRequestId && REQUEST_ID_PATTERN.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    next();
}
//# sourceMappingURL=request-id.js.map