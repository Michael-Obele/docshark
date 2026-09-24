// src/icons.ts — CLI icon styles (emoji by default; Nerd Fonts glyphs for patched terminals)
//
// Nerd Font codepoints are verified against ryanoasis/nerd-fonts glyphnames.json
// (v3.5.1). All nerd glyphs come from the Material Design Icons set (nf-md-*)
// so the monochrome style stays visually consistent. Browse equivalents at
// https://nerdfonts.com/cheat-sheet?q=<name>
//
// Scope: CLI/terminal output only. MCP tool output (server.ts, tools/*) always
// keeps emoji, because AI chat clients render emoji reliably but would show
// tofu for Private Use Area codepoints.

/** Icon rendering styles selectable via DOCSHARK_ICONS. */
export type IconStyle = "emoji" | "nerd" | "plain" | "none";

/** Semantic icon keys used across the CLI. */
export type IconKey =
  | "shark"
  | "check"
  | "cross"
  | "warn"
  | "refresh"
  | "trash"
  | "skip";

const ICON_STYLES: readonly string[] = ["emoji", "nerd", "plain", "none"];

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
 * special font. No brand glyph exists for the shark, so it is omitted here.
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

/** Resolve the icon style from DOCSHARK_ICONS (unknown or unset → "emoji"). */
export function getIconStyle(): IconStyle {
  const raw = process.env.DOCSHARK_ICONS?.trim().toLowerCase();
  if (raw && ICON_STYLES.includes(raw)) {
    return raw as IconStyle;
  }
  return "emoji";
}

/**
 * Icon for the given style followed by a single space, ready to place before
 * message text: `` `${icon("check")}Added ...` ``.
 *
 * Returns `""` for style `none` (and for keys without a glyph in a style), so
 * no stray whitespace is left behind.
 *
 * @param key - Semantic icon (e.g. "check", "warn").
 * @param style - Override; defaults to the DOCSHARK_ICONS style.
 */
export function icon(key: IconKey, style: IconStyle = getIconStyle()): string {
  const glyph = GLYPHS[style][key];
  return glyph ? `${glyph} ` : "";
}
