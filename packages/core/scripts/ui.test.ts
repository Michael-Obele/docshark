/// <reference types="bun" />

import { afterEach, describe, expect, test } from "bun:test";
import {
  displayWidth,
  fitMarkdown,
  renderTable,
  terminalWidth,
  truncate,
  wrap,
} from "../src/ui.js";

afterEach(() => {
  delete process.env.DOCSHARK_WIDTH;
});

describe("displayWidth", () => {
  test("measures cells, not characters", () => {
    expect(displayWidth("")).toBe(0);
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("日本語")).toBe(6); // CJK = 2 cells each
  });

  test("measures DocShark emoji styles correctly", () => {
    expect(displayWidth("🦈")).toBe(2);
    expect(displayWidth("✅")).toBe(2);
    expect(displayWidth("❌")).toBe(2);
    expect(displayWidth("🔄")).toBe(2);
    expect(displayWidth("🗑️")).toBe(2);
    expect(displayWidth("⏭️")).toBe(2);
    expect(displayWidth("⚠️")).toBe(2); // narrow base + VS16 upgrade
    expect(displayWidth("⚠")).toBe(1); // plain style: text presentation
    expect(displayWidth("✓")).toBe(1);
    expect(displayWidth("✗")).toBe(1);
    expect(displayWidth("»")).toBe(1);
  });

  test("Nerd Font private-use glyphs count 1 cell", () => {
    expect(displayWidth("\u{f0026}")).toBe(1); // nf-md-alert
    expect(displayWidth("\u{f18ba} ")).toBe(2); // nf-md-shark + space
  });

  test("ignores ANSI color escapes", () => {
    expect(displayWidth("\x1b[33mred\x1b[0m")).toBe(3);
  });
});

describe("truncate", () => {
  test("passes short text through unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  test("never exceeds the cell budget and ends with an ellipsis", () => {
    const out = truncate("abcdefghij", 5);
    expect(displayWidth(out)).toBeLessThanOrEqual(5);
    expect(out.endsWith("…")).toBe(true);
  });

  test("handles edge budgets", () => {
    expect(truncate("hello", 0)).toBe("");
    expect(truncate("hello", 1)).toBe("…");
    expect(truncate("日本語テスト", 4).length).toBeGreaterThan(0);
    expect(displayWidth(truncate("日本語テスト", 4))).toBeLessThanOrEqual(4);
  });
});

describe("wrap", () => {
  test("keeps every line within the budget", () => {
    const text =
      "The quick brown fox jumps over the lazy dog for quite a while";
    const out = wrap(text, 20);
    for (const line of out.split("\n")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(20);
    }
    expect(out.replace(/\s+/g, " ")).toContain("quick brown fox");
  });

  test("hard-splits unbreakable long words (URLs)", () => {
    const url = "https://example.com/a/very/long/path/that/never/ends/at/all";
    const out = wrap(url, 20);
    for (const line of out.split("\n")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(20);
    }
    expect(out.replace(/\n/g, "")).toBe(url);
  });

  test("preserves existing newlines and leading indentation", () => {
    const out = wrap("short line\n    indented content that is quite long", 20);
    expect(out.split("\n")[0]).toBe("short line");
    expect(out.split("\n")[1].startsWith("    indented")).toBe(true);
  });

  test("applies continuation indent", () => {
    const out = wrap("aaa bbb ccc ddd", 7, "  ");
    for (const line of out.split("\n")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(7);
    }
    expect(out.split("\n").length).toBeGreaterThan(1);
  });
});

describe("fitMarkdown", () => {
  test("wraps long prose to the width", () => {
    const text =
      "This is a sentence that goes on and on and definitely overflows.";
    const out = fitMarkdown(text, 30);
    for (const line of out.split("\n")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(30);
    }
  });

  test("leaves fenced code blocks and table rows untouched", () => {
    const fence =
      "```\nconst aVeryLongLineOfCodeThatMustNotBeWrapped = 123456789012345678901234567890;\n```";
    expect(fitMarkdown(fence, 20)).toBe(fence);
    const tableRow =
      "| a very long table row that would definitely exceed twenty |";
    expect(fitMarkdown(tableRow, 20)).toBe(tableRow);
    const indented =
      "        deeplyIndentedCall(argumentNumberOne, argumentNumberTwo);";
    expect(fitMarkdown(indented, 20)).toBe(indented);
  });

  test("keeps headings within the width", () => {
    const out = fitMarkdown(
      "## A heading that is far far far too long for this terminal",
      20,
    );
    for (const line of out.split("\n")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(20);
    }
  });
});

describe("renderTable", () => {
  const columns = [
    { header: "Name" },
    { header: "URL" },
    { header: "Status", flex: false },
    { header: "Last Crawled", flex: false },
  ];
  const rows = [
    [
      "svelte-5-docs-long-name",
      "https://svelte.dev/docs/svelte/overview-with-a-long-tail",
      "indexed",
      "2026-09-01 10:00:00",
    ],
    [
      "tailwind",
      "https://tailwindcss.com/docs",
      "indexed",
      "2026-09-23 09:00:00",
    ],
  ];

  for (const width of [120, 80, 60, 40, 20]) {
    test(`fits within ${width} columns`, () => {
      const out = renderTable(columns, rows, { width });
      const lines = out.split("\n");
      for (const line of lines) {
        expect(displayWidth(line)).toBeLessThanOrEqual(width);
      }
      // header + rule + one row per record
      expect(lines.length).toBe(2 + rows.length);
      expect(lines[0]).toContain("Name");
      expect(lines[0]).toContain("Status");
    });
  }

  test("shrinks the flexible URL column with an ellipsis first", () => {
    const out = renderTable(columns, rows, { width: 50 });
    expect(out).toContain("…");
    expect(out).toContain("indexed"); // protected column survives
  });
});

describe("terminalWidth", () => {
  test("honors DOCSHARK_WIDTH when in range", () => {
    process.env.DOCSHARK_WIDTH = "100";
    expect(terminalWidth()).toBe(100);
  });

  test("ignores out-of-range overrides and always returns a sane width", () => {
    process.env.DOCSHARK_WIDTH = "5";
    const w = terminalWidth();
    expect(w).toBeGreaterThanOrEqual(20);
    expect(w).toBeLessThanOrEqual(500);
  });
});
