export interface IUser {
    id?: string;
    email: string;
    name: string;
    password?: string;
    createdAt?: Date;
}
export interface IUserRepository {
    create(user: Omit<IUser, 'id' | 'createdAt'> & {
        password: string;
    }): Promise<IUser>;
    findByEmail(email: string): Promise<IUser | null>;
    findById(id: string): Promise<IUser | null>;
}
//# sourceMappingURL=user.repository.d.ts.map