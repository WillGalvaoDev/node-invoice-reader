import { AppError } from '../errors/app-error.js';
import { DEMO_DOCUMENT_KINDS } from '../demo/demo-scenario.js';
import { toDemoSessionView } from '../use-cases/demo/demo-session.view.js';
function authenticatedUserId(request) {
    const userId = request.user?.id;
    if (!userId)
        throw new AppError('Usuário não autenticado.', 401);
    return userId;
}
function routeParam(request, name) {
    const value = request.params[name];
    if (typeof value !== 'string')
        throw new AppError('Dados inválidos.', 400);
    return value;
}
function documentKind(request) {
    const kind = routeParam(request, 'kind');
    const match = DEMO_DOCUMENT_KINDS.find((candidate) => candidate === kind);
    if (!match)
        throw new AppError('Dados inválidos.', 400);
    return match;
}
export class PrepareDemoSessionController {
    useCase;
    constructor(useCase) {
        this.useCase = useCase;
    }
    async handle(request, response) {
        const { session, created } = await this.useCase.execute({ userId: authenticatedUserId(request) });
        return response.status(created ? 201 : 200).json({ status: 'success', data: { session: toDemoSessionView(session) } });
    }
}
export class GetCurrentDemoSessionController {
    useCase;
    constructor(useCase) {
        this.useCase = useCase;
    }
    async handle(request, response) {
        const session = await this.useCase.execute({ userId: authenticatedUserId(request) });
        return response.status(200).json({ status: 'success', data: { session: toDemoSessionView(session) } });
    }
}
export class GetDemoDocumentController {
    useCase;
    constructor(useCase) {
        this.useCase = useCase;
    }
    async handle(request, response) {
        const { filename, content } = await this.useCase.execute({
            userId: authenticatedUserId(request),
            sessionId: routeParam(request, 'sessionId'),
            kind: documentKind(request),
        });
        // Documento privado: nunca cacheável por intermediários; sem token em URL.
        response.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        });
        return response.status(200).send(content);
    }
}
export class RestartDemoSessionController {
    useCase;
    constructor(useCase) {
        this.useCase = useCase;
    }
    async handle(request, response) {
        const session = await this.useCase.execute({
            userId: authenticatedUserId(request),
            sessionId: routeParam(request, 'sessionId'),
        });
        return response.status(200).json({ status: 'success', data: { session: toDemoSessionView(session) } });
    }
}
//# sourceMappingURL=demo-session.controllers.js.map