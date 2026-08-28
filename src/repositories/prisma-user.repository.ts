import type { IUserRepository, IUser } from './user.repository.js';
import { prisma } from '../infra/prisma.js';
import { AppError } from '../errors/app-error.js';
import { isPrismaErrorCode } from '../errors/prisma-error.js';

export class PrismaUserRepository implements IUserRepository {
  async create(user: Omit<IUser, 'id' | 'createdAt'> & { password: string }): Promise<IUser> {
    let createdUser;
    try {
      createdUser = await prisma.user.create({
        data: {
          email: user.email,
          name: user.name,
          password: user.password,
        },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new AppError('Já existe um usuário cadastrado com este email.', 409);
      }
      throw error;
    }

    return {
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
      createdAt: createdUser.createdAt,
    };
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;
    return user;
  }

  async findById(id: string): Promise<IUser | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;
    return user;
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<IUser> {
    // Um único UPDATE: authVersion incrementado atomicamente pelo Postgres,
    // na mesma escrita que troca o hash — sem janela entre as duas mudanças.
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { password: newPasswordHash, authVersion: { increment: 1 } },
    });

    return updated;
  }
}
