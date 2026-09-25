// src/icons.ts — CLI icon styles (plain by default; emoji fallback for missing glyphs)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import * as v from "valibot";
//
// Nerd Font codepoints are verified against ryanoasis/nerd-fonts glyphnames.json
// (v3.5.1). All nerd glyphs come from the Material Design Icons set (nf-md-*)
// so the monochrome style stays visually consistent. Browse equivalents at
// https://nerdfonts.com/cheat-sheet?q=<name>
//
// Scope: CLI/terminal output only. MCP tool output (server.ts, tools/*) always
// keeps emoji, because AI chat clients render emoji reliably but would show
// tofu for Private Use Area codepoints.

/** Icon rendering styles selectable via DOCSHARK_ICONS, --icons, or `docshark icons`. */
export const ICON_STYLE_VALUES = ["emoji", "nerd", "plain", "none"] as const;
export type IconStyle = (typeof ICON_STYLE_VALUES)[number];

/** Style used when nothing is configured (safe Unicode that renders everywhere). */
export const DEFAULT_ICON_STYLE: IconStyle = "plain";

/** Semantic icon keys used across the CLI. */
export type IconKey =
  | "shark"
  | "check"
  | "cross"
  | "warn"
  | "refresh"
  | "trash"
  | "skip";

const EMOJI: Record<IconKey, string> = {
  shark: "🦈",
  check: "✅",
  cross: "❌",
  warn: "⚠️",
  refresh: "🔄",
  trash: "🗑️",
  skip: "⏭️",
};

/** Single-cell glyphs from Nerd Fonts (Material Design Icons set). */
const NERD: Record<IconKey, string> = {
  shark: "\u{f18ba}", // nf-md-shark
  check: "\u{f05e0}", // nf-md-check_circle
  cross: "\u{f0159}", // nf-md-close_circle
  warn: "\u{f0026}", // nf-md-alert
  refresh: "\u{f0450}", // nf-md-refresh
  trash: "\u{f01b4}", // nf-md-delete
  skip: "\u{f04ac}", // nf-md-skip_forward
};

/**
 * Common-monospace Unicode (GitHub TUIKit guidance: stick to characters in
 * common monospace fonts). Monochrome, but renders everywhere without a
 * special font. No monospace-safe shark glyph exists — `icon()` falls back to
 * the emoji for any key a style leaves empty.
 */
const PLAIN: Record<IconKey, string> = {
  shark: "",
  check: "✓",
  cross: "✗",
  warn: "⚠",
  refresh: "↻",
  trash: "×",
  skip: "»",
};

const NONE: Record<IconKey, string> = {
  shark: "",
  check: "",
  cross: "",
  warn: "",
  refresh: "",
  trash: "",
  skip: "",
};

const GLYPHS: Record<IconStyle, Record<IconKey, string>> = {
  emoji: EMOJI,
  nerd: NERD,
  plain: PLAIN,
  none: NONE,
};

let invalidEnvWarned = false;

/**
 * Resolve the effective icon style:
 * `--icons` flag (applied via env) > `DOCSHARK_ICONS` > config file > default.
 * An invalid env value warns once and falls through to the next source.
 */
export function getIconStyle(): IconStyle {
  const raw = process.env.DOCSHARK_ICONS?.trim().toLowerCase();
  if (raw) {
    const parsed = v.safeParse(v.picklist([...ICON_STYLE_VALUES]), raw);
    if (parsed.success) return parsed.output;
    if (!invalidEnvWarned) {
      invalidEnvWarned = true;
      console.error(
        `⚠ Invalid DOCSHARK_ICONS="${raw}" — valid: ${ICON_STYLE_VALUES.join(" | ")}`,
      );
    }
  }
  return readIconStyleFromConfig() ?? DEFAULT_ICON_STYLE;
}

/** Path of the DocShark config file (`<data dir>/config.json`). */
export function iconConfigPath(): string {
  const dir = process.env.DOCSHARK_DATA_DIR || resolve(homedir(), ".docshark");
  return resolve(dir, "config.json");
}

/** Validated icon style from the config file, or null when absent/invalid. */
export function readIconStyleFromConfig(): IconStyle | null {
  try {
    const config = JSON.parse(readFileSync(iconConfigPath(), "utf8")) as {
      icons?: unknown;
    };
    const parsed = v.safeParse(
      v.optional(v.picklist([...ICON_STYLE_VALUES])),
      config.icons,
    );
    return parsed.success ? (parsed.output ?? null) : null;
  } catch {
    return null;
  }
}

/** Persist the icon style to the config file (preserving other keys). */
export function writeIconStyle(style: IconStyle): void {
  const file = iconConfigPath();
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    // no config yet (or unreadable) — start fresh
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify({ ...config, icons: style }, null, 2)}\n`,
  );
}

/**
 * Icon for the given style followed by a single space, ready to place before
 * message text: `` `${icon("check")}Added ...` ``.
 *
 * Returns `""` for style `none`. Styles missing a glyph (e.g. plain's shark)
 * fall back to the emoji, so no icon is ever silently dropped.
 *
 * @param key - Semantic icon (e.g. "check", "warn").
 * @param style - Override; defaults to the configured style.
 */
export function icon(key: IconKey, style: IconStyle = getIconStyle()): string {
  if (style === "none") return "";
  const glyph = GLYPHS[style][key] || EMOJI[key];
  return glyph ? `${glyph} ` : "";
}
