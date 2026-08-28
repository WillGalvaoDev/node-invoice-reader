import type { IUserRepository, IUser } from '../../repositories/user.repository.js';
import type { IHashProvider } from '../../providers/hash.provider.js';
interface IRegisterUserRequest {
    name: string;
    email: string;
    password: string;
    inviteCode?: string;
}
export declare class RegisterUserUseCase {
    private userRepository;
    private hashProvider;
    private inviteCode;
    constructor(userRepository: IUserRepository, hashProvider: IHashProvider, inviteCode: string);
    execute({ name, email, password, inviteCode }: IRegisterUserRequest): Promise<IUser>;
}
export {};
//# sourceMappingURL=register-user.use-case.d.ts.map