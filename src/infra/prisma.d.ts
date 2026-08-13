import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<{
    adapter: PrismaPg;
}, never, import("@prisma/client/runtime/client").DefaultArgs>;
export declare function disconnectPrisma(): Promise<void>;
//# sourceMappingURL=prisma.d.ts.map