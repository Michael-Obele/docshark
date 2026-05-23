import { afterEach, describe, expect, test } from "bun:test";
import { discoverPages } from "../src/scraper/discoverer.js";
import { fetchPage } from "../src/scraper/fetcher.js";
import { RateLimiter } from "../src/scraper/rate-limiter.js";
import { getRobotsParser, isAllowed } from "../src/scraper/robots.js";

const originalFetch = globalThis.fetch;

type MockResponseFactory = () => Response | Promise<Response>;

function installFetchMock(
  routes: Record<string, Response | MockResponseFactory>,
) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const handler = routes[url];

    if (!handler) {
      throw new Error(`Unexpected fetch for ${url}`);
    }

    return typeof handler === "function" ? await handler() : handler;
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("robots and crawl discovery", () => {
  test("parses robots.txt rules", async () => {
    installFetchMock({
      "https://docs.python.org/robots.txt": new Response(
        "User-agent: *\nDisallow: /private\nAllow: /docs",
        { status: 200 },
      ),
    });

    const robots = await getRobotsParser("https://docs.python.org/");

    expect(isAllowed(robots, "https://docs.python.org/tutorial/")).toBe(true);
    expect(isAllowed(robots, "https://docs.python.org/private/plan")).toBe(
      false,
    );
  });

  test("discovers sitemap URLs and applies path and exclude filters", async () => {
    installFetchMock({
      "https://docs.python.org/robots.txt": new Response("", { status: 404 }),
      "https://docs.python.org/sitemap.xml": new Response(
        `
          <urlset>
            <url><loc>https://docs.python.org/tutorial/</loc></url>
            <url><loc>https://docs.python.org/private/secret</loc></url>
            <url><loc>https://docs.python.org/blog/post</loc></url>
            <url><loc>https://other.python.org/docs/ignored</loc></url>
          </urlset>
        `,
        {
          status: 200,
          headers: { "content-type": "application/xml" },
        },
      ),
    });

    const urls = await discoverPages("https://docs.python.org/", {
      includePatterns: ["/tutorial/"],
      excludePatterns: ["/private/"],
    });

    expect(urls).toEqual(["https://docs.python.org/tutorial/"]);
  });
});

describe("fetchPage", () => {
  test("returns fetch results with headers in fetch mode", async () => {
    installFetchMock({
      "https://docs.python.org/3/": new Response(
        "<html><body>DocShark</body></html>",
        {
          status: 200,
          headers: {
            etag: "etag-1",
            "last-modified": "Sat, 23 May 2026 00:00:00 GMT",
            "content-type": "text/html",
          },
        },
      ),
    });

    const result = await fetchPage("https://docs.python.org/3/", "fetch");

    expect(result.renderer).toBe("fetch");
    expect(result.etag).toBe("etag-1");
    expect(result.lastModified).toBe("Sat, 23 May 2026 00:00:00 GMT");
  });

  test("stays on fetch in auto mode when extracted content is substantial", async () => {
    installFetchMock({
      "https://docs.python.org/3/tutorial/": new Response(
        `# Guide\n\n${"Useful documentation content. ".repeat(30)}`,
        {
          status: 200,
          headers: { "content-type": "text/markdown" },
        },
      ),
    });

    const result = await fetchPage(
      "https://docs.python.org/3/tutorial/",
      "auto",
    );

    expect(result.renderer).toBe("fetch");
    expect(result.status).toBe(200);
  });
});

describe("RateLimiter", () => {
  test("waits at least the configured delay between requests", async () => {
    const limiter = new RateLimiter(25);

    await limiter.wait();
    const startedAt = Date.now();
    await limiter.wait();

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(15);
  });
});
