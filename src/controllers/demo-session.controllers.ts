import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { DEMO_DOCUMENT_KINDS, type DemoDocumentKind } from '../demo/demo-scenario.js';
import type { PrepareDemoSessionUseCase } from '../use-cases/demo/prepare-demo-session.use-case.js';
import type { GetCurrentDemoSessionUseCase } from '../use-cases/demo/get-current-demo-session.use-case.js';
import type { GetDemoDocumentUseCase } from '../use-cases/demo/get-demo-document.use-case.js';
import type { RestartDemoSessionUseCase } from '../use-cases/demo/restart-demo-session.use-case.js';
import { toDemoSessionView } from '../use-cases/demo/demo-session.view.js';

function authenticatedUserId(request: Request): string {
  const userId = request.user?.id;
  if (!userId) throw new AppError('Usuário não autenticado.', 401);
  return userId;
}

function routeParam(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string') throw new AppError('Dados inválidos.', 400);
  return value;
}

function documentKind(request: Request): DemoDocumentKind {
  const kind = routeParam(request, 'kind');
  const match = DEMO_DOCUMENT_KINDS.find((candidate) => candidate === kind);
  if (!match) throw new AppError('Dados inválidos.', 400);
  return match;
}

export class PrepareDemoSessionController {
  constructor(private readonly useCase: PrepareDemoSessionUseCase) {}

  async handle(request: Request, response: Response) {
    const { session, created } = await this.useCase.execute({ userId: authenticatedUserId(request) });
    return response.status(created ? 201 : 200).json({ status: 'success', data: { session: toDemoSessionView(session) } });
  }
}

export class GetCurrentDemoSessionController {
  constructor(private readonly useCase: GetCurrentDemoSessionUseCase) {}

  async handle(request: Request, response: Response) {
    const session = await this.useCase.execute({ userId: authenticatedUserId(request) });
    return response.status(200).json({ status: 'success', data: { session: toDemoSessionView(session) } });
  }
}

export class GetDemoDocumentController {
  constructor(private readonly useCase: GetDemoDocumentUseCase) {}

  async handle(request: Request, response: Response) {
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
  constructor(private readonly useCase: RestartDemoSessionUseCase) {}

  async handle(request: Request, response: Response) {
    const session = await this.useCase.execute({
      userId: authenticatedUserId(request),
      sessionId: routeParam(request, 'sessionId'),
    });
    return response.status(200).json({ status: 'success', data: { session: toDemoSessionView(session) } });
  }
}
