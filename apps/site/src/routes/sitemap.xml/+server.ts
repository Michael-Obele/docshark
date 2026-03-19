import type { RequestEvent } from "@sveltejs/kit";

const staticRoutes = [
  "/",
  "/docs",
  "/docs/getting-started",
  "/docs/tools-spec",
  "/docs/scraping-pipeline",
  "/docs/database-schema",
  "/docs/project-structure",
] as const;

export function GET({ url }: RequestEvent) {
  const origin = url.origin;
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = staticRoutes.map((route) => {
    const priority = route === "/" ? "1.0" : route === "/docs" ? "0.9" : "0.7";
    return `  <url>\n    <loc>${origin}${route}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  });

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
      },
    },
  );
}
