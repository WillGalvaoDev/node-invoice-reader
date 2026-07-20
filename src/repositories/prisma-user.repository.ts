import { PrismaClient } from '@prisma/client';
import type { IUserRepository, IUser } from './user.repository.js';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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