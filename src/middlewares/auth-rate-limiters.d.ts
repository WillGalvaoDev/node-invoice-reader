interface IpRateLimiterOptions {
    windowMs: number;
    max: number;
    message: string;
}
export declare const AUTH_RATE_LIMIT_POLICIES: {
    readonly login: {
        readonly windowMs: number;
        readonly max: 10;
        readonly message: "Limite de tentativas de login atingido. Tente novamente mais tarde.";
    };
    readonly userRegistration: {
        readonly windowMs: number;
        readonly max: 5;
        readonly message: "Limite de cadastros atingido. Tente novamente mais tarde.";
    };
};
export declare function createIpRateLimiter({ windowMs, max, message }: IpRateLimiterOptions): import("express-rate-limit").RateLimitRequestHandler;
export declare const loginRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const userRegistrationRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export {};
//# sourceMappingURL=auth-rate-limiters.d.ts.map