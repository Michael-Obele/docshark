// src/scraper/rate-limiter.ts — Configurable rate limiter for polite crawling

export class RateLimiter {
    private lastRequest = 0;

    constructor(private delayMs: number = 500) { }

    async wait(): Promise<void> {
        const elapsed = Date.now() - this.lastRequest;
        if (elapsed < this.delayMs) {
            await new Promise((resolve) => setTimeout(resolve, this.delayMs - elapsed));
        }
        this.lastRequest = Date.now();
    }

    setDelay(ms: number) {
        this.delayMs = ms;
    }
}
