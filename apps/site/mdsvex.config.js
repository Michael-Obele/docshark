import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { createHighlighter } from "shiki";

const highlighter = await createHighlighter({
  themes: ["github-dark-default"],
  langs: [
    "typescript",
    "javascript",
    "json",
    "bash",
    "html",
    "css",
    "svelte",
    "sql",
    "yaml",
    "markdown",
    "toml",
  ],
});

/** @type {import('mdsvex').MdsvexOptions} */
export const mdsvexConfig = {
  extensions: [".md", ".svx"],
  highlight: {
    highlighter: (code, lang) => {
      const html = highlighter.codeToHtml(code, {
        lang: lang || "text",
        theme: "github-dark-default",
      });
      return `{@html \`${html.replace(/`/g, "\\`")}\`}`;
    },
  },
  rehypePlugins: [
    rehypeSlug,
    [
      rehypeAutolinkHeadings,
      {
        behavior: "wrap",
      },
    ],
  ],
};
