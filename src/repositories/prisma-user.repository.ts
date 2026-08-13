import type { IUserRepository, IUser } from './user.repository.js';
import { prisma } from '../infra/prisma.js';

export class PrismaUserRepository implements IUserRepository {
  async create(user: Omit<IUser, 'id' | 'createdAt'> & { password: string }): Promise<IUser> {
    const createdUser = await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        password: user.password,
      },
    });

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
}
