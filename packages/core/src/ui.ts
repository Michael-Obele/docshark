// src/ui.ts — Terminal-width-aware output helpers (zero-dependency)
//
// Research basis (2026-09): terminals measure text in CELLS, not characters —
// emoji/CJK occupy 2 cells, combining marks 0, ambiguous/Nerd-Font glyphs 1
// (Unicode core spec §5; xterm defaults). Truncation/wrapping must therefore
// be display-width based. Canonical npm equivalents: string-width, cli-truncate,
// wrap-ansi — reimplemented here in minimal form to keep the package
// dependency-free (AGENTS.md intentional minimalism).
//
// Width source: DOCSHARK_WIDTH (override, 20–500) > stdout.columns > 80,
// re-read on every call so output tracks resizes between commands.

const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Code point ranges that occupy 2 cells (EAW Wide/Fullwidth + emoji). */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2e80, 0x303e], // CJK radicals, Kangxi, CJK symbols
  [0x3041, 0x33ff], // Kana, CJK compat
  [0x3400, 0x4dbf], // CJK ext A
  [0x4e00, 0x9fff], // CJK unified
  [0xa000, 0xa4cf], // Yi
  [0xa960, 0xa97f], // Hangul Jamo ext A
  [0xac00, 0xd7a3], // Hangul syllables
  [0xf900, 0xfaff], // CJK compat ideographs
  [0xfe10, 0xfe19], // Vertical forms
  [0xfe30, 0xfe6f], // CJK compat forms
  [0xff00, 0xff60], // Fullwidth forms
  [0xffe0, 0xffe6], // Fullwidth signs
  [0x1f000, 0x1faff], // Emoji (mahjong … ntids), incl. 🦈 ✅ ❌ 🔄 🗑
  [0x20000, 0x3fffd], // CJK ext B+
];

/** Explicit emoji-presentation singles outside the emoji blocks (EAW Wide). */
const WIDE_SINGLES = new Set<number>([
  0x231a, 0x231b, 0x23e9, 0x23ea, 0x23eb, 0x23ec, 0x23f0, 0x23f3,
  0x25fd, 0x25fe, 0x2614, 0x2615, 0x2648, 0x2649, 0x264a, 0x264b, 0x264c,
  0x264d, 0x264e, 0x264f, 0x2650, 0x2651, 0x2652, 0x2653, 0x267f, 0x2693,
  0x26a1, 0x26aa, 0x26ab, 0x26bd, 0x26be, 0x26c4, 0x26c5, 0x26ce, 0x26d4,
  0x26ea, 0x26f2, 0x26f3, 0x26f5, 0x26fa, 0x26fd, 0x2705, 0x270a, 0x270b,
  0x2728, 0x274c, 0x274e, 0x2753, 0x2754, 0x2755, 0x2757, 0x2795, 0x2796,
  0x2797, 0x27b0, 0x27bf, 0x2b1b, 0x2b1c, 0x2b50, 0x2b55, 0x23ed, 0x23ee,
  0x23f1, 0x23f2,
]);

/** Zero-width: combining marks, variation selectors, zero-width spaces/joins. */
const ZERO_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0300, 0x036f],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x200b, 0x200f],
  [0x20d0, 0x20ff],
  [0xfe00, 0xfe0f], // variation selectors (FE0F handled by emoji upgrade below)
  [0xfe20, 0xfe2f],
];

function inRanges(cp: number, ranges: ReadonlyArray<readonly [number, number]>): boolean {
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

/**
 * Visible cell width of a string in a terminal.
 * ANSI escapes and zero-width characters count 0; emoji/CJK count 2.
 */
export function displayWidth(text: string): number {
  const plain = text.replace(ANSI_RE, "");
  let width = 0;
  let vs16Pending = false;
  for (const ch of plain) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xfe0f) {
      // Emoji variation selector: upgrades the previous narrow base to 2 cells.
      if (vs16Pending) width += 1;
      vs16Pending = false;
      continue;
    }
    if (inRanges(cp, ZERO_RANGES)) continue;
    let w = 1;
    if (inRanges(cp, WIDE_RANGES) || WIDE_SINGLES.has(cp)) w = 2;
    width += w;
    vs16Pending = w === 1;
  }
  return width;
}

/** Truncate to at most `max` cells, ending with "…" when content was cut. */
export function truncate(text: string, max: number): string {
  if (max <= 0) return "";
  if (displayWidth(text) <= max) return text;
  if (max === 1) return "…";
  const budget = max - 1; // reserve one cell for the ellipsis
  let out = "";
  let width = 0;
  for (const ch of text.replace(ANSI_RE, "")) {
    const w = displayWidth(ch);
    if (width + w > budget) break;
    out += ch;
    width += w;
  }
  return `${out}…`;
}

/**
 * Greedy word-wrap to `max` cells. Overlong single words (URLs) are hard-split
 * in a second pass. Existing newlines are preserved; continuation lines are
 * prefixed with `indent` (or the line's own leading whitespace when empty).
 */
export function wrap(text: string, max: number, indent = ""): string {
  if (max <= 0) return text;
  const out: string[] = [];

  for (const raw of text.split("\n")) {
    if (displayWidth(raw) <= max) {
      out.push(raw);
      continue;
    }

    const leading = raw.match(/^[ \t]*/)?.[0] ?? "";
    const words = raw.slice(leading.length).split(/[ \t]+/).filter(Boolean);
    let prefix = leading;
    let line = "";

    const flush = () => {
      out.push(prefix + line);
      prefix = indent || leading;
      line = "";
    };

    for (const word of words) {
      const candidate = line === "" ? word : `${line} ${word}`;
      if (displayWidth(prefix + candidate) <= max) {
        line = candidate;
      } else if (line === "") {
        line = word; // hard-split pass below will cut it to size
      } else {
        flush();
        line = word;
      }
    }
    if (line !== "") out.push(prefix + line);
    else if (words.length === 0) out.push(raw);
  }

  // Second pass: hard-split any line still over budget (long URLs, no spaces).
  const fitted: string[] = [];
  for (const line of out) {
    if (displayWidth(line) <= max) {
      fitted.push(line);
      continue;
    }
    let rest = line;
    while (displayWidth(rest) > max) {
      let chunk = "";
      let w = 0;
      for (const ch of rest) {
        const cw = displayWidth(ch);
        if (w + cw > max) break;
        chunk += ch;
        w += cw;
      }
      if (chunk === "") break; // pathological single wide char at max=1
      fitted.push(chunk);
      rest = rest.slice(chunk.length);
    }
    if (rest.length > 0) fitted.push(rest);
  }
  return fitted.join("\n");
}

/** Wrap markdown-ish text for display: prose wraps; code fences, tables and indented code stay raw. */
export function fitMarkdown(text: string, max: number): string {
  let inFence = false;
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      if (/^\s*\|/.test(line)) return line; // markdown table row
      if (/^\s{4,}\S/.test(line)) return line; // indented code block
      if (/^#{1,6}\s/.test(line)) return truncate(line, max); // headings: truncate, keep semantic
      if (displayWidth(line) <= max) return line;
      // Bullet/quote continuations align under the marker.
      const m = line.match(/^(\s*(?:[-*+]\s|>\s|\d+\.\s))/);
      const indent = m ? " ".repeat(Math.min(displayWidth(m[1]), 8)) : "";
      return wrap(line, max, indent);
    })
    .join("\n");
}

export type TableColumn = {
  header: string;
  /** Columns allowed to shrink when space is tight (default: all). */
  flex?: boolean;
};

/**
 * Render an aligned text table (header + rule + rows) that NEVER exceeds
 * `width` cells. Flexible columns shrink first (widest first, ellipsed);
 * protected columns only shrink as a last resort.
 */
export function renderTable(
  columns: TableColumn[],
  rows: string[][],
  opts: { width?: number; indent?: string } = {},
): string {
  const width = opts.width ?? terminalWidth();
  const indent = opts.indent ?? "";
  const gap = 2;
  const n = columns.length;
  if (n === 0) return "";

  const natural = columns.map((col, i) =>
    Math.max(
      displayWidth(col.header),
      ...rows.map((row) => displayWidth(row[i] ?? "")),
      1,
    ),
  );
  const minWidths = columns.map((col, i) =>
    Math.min(natural[i], Math.max(displayWidth(col.header), 3)),
  );
  const flexFlags = columns.map((col) => col.flex !== false);

  const widths = [...natural];
  const overhead = indentWidth(indent) + gap * (n - 1);
  let total = widths.reduce((a, b) => a + b, 0) + overhead;

  const shrinkable = (i: number) =>
    flexFlags[i] ? widths[i] > minWidths[i] : false;
  const anyShrinkable = (onlyProtected: boolean) =>
    widths.some((w, i) =>
      onlyProtected ? !flexFlags[i] && w > minWidths[i] : shrinkable(i),
    );

  // Pass 1: shrink flexible columns, widest first.
  while (total > width && anyShrinkable(false)) {
    let idx = -1;
    let best = -1;
    for (let i = 0; i < n; i++) {
      if (shrinkable(i) && widths[i] > best) {
        best = widths[i];
        idx = i;
      }
    }
    if (idx === -1) break;
    widths[idx] -= 1;
    total -= 1;
  }
  // Pass 2: protected columns shrink as a last resort (down to their minimum).
  while (total > width && anyShrinkable(true)) {
    let idx = -1;
    let best = -1;
    for (let i = 0; i < n; i++) {
      if (!flexFlags[i] && widths[i] > minWidths[i] && widths[i] > best) {
        best = widths[i];
        idx = i;
      }
    }
    if (idx === -1) break;
    widths[idx] -= 1;
    total -= 1;
  }

  const pad = (text: string, w: number): string => {
    const t = truncate(text, w);
    return t + " ".repeat(Math.max(0, w - displayWidth(t)));
  };

  const line = (cells: string[]): string =>
    indent +
    cells.map((cell, i) => pad(cell, widths[i])).join(" ".repeat(gap)).trimEnd();

  const out: string[] = [];
  out.push(line(columns.map((c) => c.header)));
  out.push(
    indent +
      widths.map((w) => "─".repeat(w)).join(" ".repeat(gap)),
  );
  for (const row of rows) {
    out.push(line(columns.map((_, i) => row[i] ?? "")));
  }

  // Absolute guarantee: never exceed the budget, whatever happened above.
  return out.map((l) => truncate(l, width)).join("\n");
}

function indentWidth(indent: string): number {
  return displayWidth(indent);
}

/**
 * Current output width in cells, re-read per call:
 * DOCSHARK_WIDTH (20–500) > stdout.columns > 80.
 */
export function terminalWidth(): number {
  const raw = process.env.DOCSHARK_WIDTH;
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 20 && parsed <= 500) {
      return parsed;
    }
  }
  const columns = process.stdout?.columns;
  if (typeof columns === "number" && columns >= 20) {
    return Math.min(columns, 500);
  }
  return 80;
}
