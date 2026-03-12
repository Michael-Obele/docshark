// src/scraper/robots.ts — robots.txt parser
import robotsParser from 'robots-parser';

const USER_AGENT = 'DocShark/1.0';

/** Fetch and parse robots.txt for a given base URL */
export async function getRobotsParser(baseUrl: string) {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;

    try {
        const response = await fetch(robotsUrl, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) return null;

        const body = await response.text();
        return robotsParser(robotsUrl, body);
    } catch {
        return null;
    }
}

/** Check if a URL is allowed by robots.txt */
export function isAllowed(robots: ReturnType<typeof robotsParser> | null, url: string): boolean {
    if (!robots) return true;
    return robots.isAllowed(url, USER_AGENT) !== false;
}
