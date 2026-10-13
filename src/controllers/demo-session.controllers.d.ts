import type { Request, Response } from 'express';
import type { PrepareDemoSessionUseCase } from '../use-cases/demo/prepare-demo-session.use-case.js';
import type { GetCurrentDemoSessionUseCase } from '../use-cases/demo/get-current-demo-session.use-case.js';
import type { GetDemoDocumentUseCase } from '../use-cases/demo/get-demo-document.use-case.js';
import type { RestartDemoSessionUseCase } from '../use-cases/demo/restart-demo-session.use-case.js';
export declare class PrepareDemoSessionController {
    private readonly useCase;
    constructor(useCase: PrepareDemoSessionUseCase);
    handle(request: Request, response: Response): Promise<Response<any, Record<string, any>>>;
}
export declare class GetCurrentDemoSessionController {
    private readonly useCase;
    constructor(useCase: GetCurrentDemoSessionUseCase);
    handle(request: Request, response: Response): Promise<Response<any, Record<string, any>>>;
}
export declare class GetDemoDocumentController {
    private readonly useCase;
    constructor(useCase: GetDemoDocumentUseCase);
    handle(request: Request, response: Response): Promise<Response<any, Record<string, any>>>;
}
export declare class RestartDemoSessionController {
    private readonly useCase;
    constructor(useCase: RestartDemoSessionUseCase);
    handle(request: Request, response: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=demo-session.controllers.d.ts.map