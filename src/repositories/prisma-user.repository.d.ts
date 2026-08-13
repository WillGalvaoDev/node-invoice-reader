import type { IUserRepository, IUser } from './user.repository.js';
export declare class PrismaUserRepository implements IUserRepository {
    create(user: Omit<IUser, 'id' | 'createdAt'> & {
        password: string;
    }): Promise<IUser>;
    findByEmail(email: string): Promise<IUser | null>;
    findById(id: string): Promise<IUser | null>;
}
//# sourceMappingURL=prisma-user.repository.d.ts.map