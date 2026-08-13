import type { IUserRepository } from '../../repositories/user.repository.js';
import type { IHashProvider } from '../../providers/hash.provider.js';
import type { ITokenProvider } from '../../providers/token.provider.js';
interface ILoginRequest {
    email: string;
    password: string;
}
interface ILoginResponse {
    token: string;
}
export declare class LoginUseCase {
    private userRepository;
    private hashProvider;
    private tokenProvider;
    constructor(userRepository: IUserRepository, hashProvider: IHashProvider, tokenProvider: ITokenProvider);
    execute({ email, password }: ILoginRequest): Promise<ILoginResponse>;
}
export {};
//# sourceMappingURL=login.use-case.d.ts.map