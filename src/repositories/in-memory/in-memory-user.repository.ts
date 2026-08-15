import type { IUser, IUserRepository } from '../user.repository.js';

export class InMemoryUserRepository implements IUserRepository {
  public items: IUser[] = [];

  async create(user: Omit<IUser, 'id' | 'createdAt'> & { password: string }): Promise<IUser> {
    const id = `user-${this.items.length + 1}`;
    const createdAt = new Date();

    this.items.push({ id, email: user.email, name: user.name, password: user.password, createdAt });
    return { id, email: user.email, name: user.name, createdAt };
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.items.find((item) => item.email === email) ?? null;
  }

  async findById(id: string): Promise<IUser | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }
}
