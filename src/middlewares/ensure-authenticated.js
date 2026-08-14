import { AppError } from '../errors/app-error.js';
function bearerToken(authorization) {
    if (!authorization)
        throw new AppError('JWT token não informado.', 401);
    const parts = authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
        throw new AppError('JWT token inválido ou expirado.', 401);
    }
    return parts[1];
}
export function createEnsureAuthenticated({ tokenProvider, userRepository }) {
    return async function ensureAuthenticated(request, _response, next) {
        const token = bearerToken(request.headers.authorization);
        try {
            const decoded = await tokenProvider.verifyToken(token);
            if (!decoded?.sub)
                throw new AppError('JWT token inválido ou expirado.', 401);
            const user = await userRepository.findById(decoded.sub);
            if (!user)
                throw new AppError('Usuário não encontrado ou conta removida.', 401);
            request.user = { id: decoded.sub };
            next();
        }
        catch (error) {
            if (error instanceof AppError)
                throw error;
            throw new AppError('JWT token inválido ou expirado.', 401);
        }
    };
}
//# sourceMappingURL=ensure-authenticated.js.map