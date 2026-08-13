import type { IUserRepository, IUser } from '../../repositories/user.repository.js';
import type { IHashProvider } from '../../providers/hash.provider.js';
interface IRegisterUserRequest {
    name: string;
    email: string;
    password: string;
}
export declare class RegisterUserUseCase {
    private userRepository;
    private hashProvider;
    constructor(userRepository: IUserRepository, hashProvider: IHashProvider);
    execute({ name, email, password }: IRegisterUserRequest): Promise<IUser>;
}
export {};
//# sourceMappingURL=register-user.use-case.d.ts.map