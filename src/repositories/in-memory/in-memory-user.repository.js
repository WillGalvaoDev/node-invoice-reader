export class InMemoryUserRepository {
    items = [];
    async create(user) {
        const id = `user-${this.items.length + 1}`;
        const createdAt = new Date();
        this.items.push({ id, email: user.email, name: user.name, password: user.password, createdAt });
        return { id, email: user.email, name: user.name, createdAt };
    }
    async findByEmail(email) {
        return this.items.find((item) => item.email === email) ?? null;
    }
    async findById(id) {
        return this.items.find((item) => item.id === id) ?? null;
    }
}
//# sourceMappingURL=in-memory-user.repository.js.map