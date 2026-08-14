import type { RequestHandler } from 'express';
import type { ITokenProvider } from '../providers/token.provider.js';
import type { IUserRepository } from '../repositories/user.repository.js';
export interface AuthenticateMiddlewareDependencies {
    tokenProvider: ITokenProvider;
    userRepository: IUserRepository;
}
export declare function createEnsureAuthenticated({ tokenProvider, userRepository }: AuthenticateMiddlewareDependencies): RequestHandler;
//# sourceMappingURL=ensure-authenticated.d.ts.map