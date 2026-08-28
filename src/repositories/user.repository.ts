export interface IUser {
  id?: string;
  email: string;
  name: string;
  password?: string; // Opcional para quando retornamos o usuário sem expor o hash
  authVersion?: number; // Opcional pelo mesmo motivo do password: create() não o expõe na resposta de cadastro
  createdAt?: Date;
}

// Contrato que qualquer banco de dados (Prisma, Mongo, etc.) precisará seguir
export interface IUserRepository {
  create(user: Omit<IUser, 'id' | 'createdAt'> & { password: string }): Promise<IUser>;
  findByEmail(email: string): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
  /**
   * Grava o novo hash de senha e incrementa authVersion na MESMA escrita —
   * nunca duas operações separadas, para que não exista janela em que a
   * senha mudou e a versão não (P2-02).
   */
  updatePassword(userId: string, newPasswordHash: string): Promise<IUser>;
}