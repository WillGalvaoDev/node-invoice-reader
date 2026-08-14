export declare function startApplication(): {
    app: import("express-serve-static-core").Express;
    server: import("node:http").Server<typeof import("node:http").IncomingMessage, typeof import("node:http").ServerResponse>;
    lifecycle: {
        shutdown(trigger: string, exitCode: number): Promise<void>;
    };
    uninstallProcessHandlers: () => void;
};
//# sourceMappingURL=index.d.ts.map