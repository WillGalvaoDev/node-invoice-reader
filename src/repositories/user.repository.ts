export interface IUser {
  id?: string;
  email: string;
  name: string;
  password?: string; // Opcional para quando retornamos o usuário sem expor o hash
  createdAt?: Date;
}

// Contrato que qualquer banco de dados (Prisma, Mongo, etc.) precisará seguir
export interface IUserRepository {
  create(user: Omit<IUser, 'id' | 'createdAt'> & { password: string }): Promise<IUser>;
  findByEmail(email: string): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
}