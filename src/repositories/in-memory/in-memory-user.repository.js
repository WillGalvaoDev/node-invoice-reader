export class InMemoryUserRepository {
    items = [];
    async create(user) {
        const id = `user-${this.items.length + 1}`;
        const createdAt = new Date();
        this.items.push({ id, email: user.email, name: user.name, password: user.password, authVersion: 1, createdAt });
        return { id, email: user.email, name: user.name, createdAt };
    }
    async findByEmail(email) {
        return this.items.find((item) => item.email === email) ?? null;
    }
    async findById(id) {
        return this.items.find((item) => item.id === id) ?? null;
    }
    async updatePassword(userId, newPasswordHash) {
        const index = this.items.findIndex((item) => item.id === userId);
        if (index === -1) {
            throw new Error('Usuário não encontrado no repositório em memória.');
        }
        const current = this.items[index];
        const updated = { ...current, password: newPasswordHash, authVersion: (current.authVersion ?? 1) + 1 };
        this.items[index] = updated;
        return updated;
    }
}
//# sourceMappingURL=in-memory-user.repository.js.map