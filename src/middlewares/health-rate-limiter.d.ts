export declare const HEALTH_RATE_LIMIT_POLICY: {
    readonly windowMs: 60000;
    readonly max: 60;
};
interface HealthRateLimiterOptions {
    windowMs?: number;
    max?: number;
}
export declare function createHealthRateLimiter({ windowMs, max, }?: HealthRateLimiterOptions): import("express-rate-limit").RateLimitRequestHandler;
export {};
//# sourceMappingURL=health-rate-limiter.d.ts.map