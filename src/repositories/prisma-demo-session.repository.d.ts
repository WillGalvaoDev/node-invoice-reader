import type { DemoIdentityFactory, IDemoSession, IDemoSessionRepository } from './demo-session.repository.js';
export declare class PrismaDemoSessionRepository implements IDemoSessionRepository {
    findActiveByOwner(ownerId: string): Promise<IDemoSession | null>;
    findByIdForOwner(id: string, ownerId: string): Promise<IDemoSession | null>;
    createForOwner(ownerId: string, identity: DemoIdentityFactory): Promise<{
        session: IDemoSession;
        created: boolean;
    }>;
    restart(sessionId: string, ownerId: string, identity: DemoIdentityFactory): Promise<IDemoSession | null>;
}
//# sourceMappingURL=prisma-demo-session.repository.d.ts.map