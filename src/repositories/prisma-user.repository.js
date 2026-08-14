import { prisma } from '../infra/prisma.js';
import { AppError } from '../errors/app-error.js';
import { isPrismaErrorCode } from '../errors/prisma-error.js';
export class PrismaUserRepository {
    async create(user) {
        let createdUser;
        try {
            createdUser = await prisma.user.create({
                data: {
                    email: user.email,
                    name: user.name,
                    password: user.password,
                },
            });
        }
        catch (error) {
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
    async findByEmail(email) {
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user)
            return null;
        return user;
    }
    async findById(id) {
        const user = await prisma.user.findUnique({
            where: { id },
        });
        if (!user)
            return null;
        return user;
    }
}
//# sourceMappingURL=prisma-user.repository.js.map