import type { IUser, IUserRepository } from '../user.repository.js';
export declare class InMemoryUserRepository implements IUserRepository {
    items: IUser[];
    create(user: Omit<IUser, 'id' | 'createdAt'> & {
        password: string;
    }): Promise<IUser>;
    findByEmail(email: string): Promise<IUser | null>;
    findById(id: string): Promise<IUser | null>;
}
//# sourceMappingURL=in-memory-user.repository.d.ts.map