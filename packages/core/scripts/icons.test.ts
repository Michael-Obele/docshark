/// <reference types="bun" />

import { afterEach, describe, expect, test } from "bun:test";
import { getIconStyle, icon } from "../src/icons.js";

const ALL_KEYS = [
  "shark",
  "check",
  "cross",
  "warn",
  "refresh",
  "trash",
  "skip",
] as const;

afterEach(() => {
  delete process.env.DOCSHARK_ICONS;
});

describe("icon styles", () => {
  test("getIconStyle defaults to emoji and resolves DOCSHARK_ICONS", () => {
    expect(getIconStyle()).toBe("emoji");

    process.env.DOCSHARK_ICONS = "nerd";
    expect(getIconStyle()).toBe("nerd");

    process.env.DOCSHARK_ICONS = "  PLAIN  ";
    expect(getIconStyle()).toBe("plain");

    process.env.DOCSHARK_ICONS = "none";
    expect(getIconStyle()).toBe("none");

    process.env.DOCSHARK_ICONS = "not-a-style";
    expect(getIconStyle()).toBe("emoji");
  });

  test("emoji style returns the original glyphs with a trailing space", () => {
    expect(icon("check", "emoji")).toBe("✅ ");
    expect(icon("cross", "emoji")).toBe("❌ ");
    expect(icon("warn", "emoji")).toBe("⚠️ ");
    expect(icon("refresh", "emoji")).toBe("🔄 ");
    expect(icon("trash", "emoji")).toBe("🗑️ ");
    expect(icon("skip", "emoji")).toBe("⏭️ ");
    expect(icon("shark", "emoji")).toBe("🦈 ");
  });

  test("nerd style emits the verified Nerd Font codepoints", () => {
    // Verified against ryanoasis/nerd-fonts glyphnames.json v3.5.1 (nf-md-*).
    expect(icon("shark", "nerd").codePointAt(0)).toBe(0xf18ba); // md-shark
    expect(icon("check", "nerd").codePointAt(0)).toBe(0xf05e0); // md-check_circle
    expect(icon("cross", "nerd").codePointAt(0)).toBe(0xf0159); // md-close_circle
    expect(icon("warn", "nerd").codePointAt(0)).toBe(0xf0026); // md-alert
    expect(icon("refresh", "nerd").codePointAt(0)).toBe(0xf0450); // md-refresh
    expect(icon("trash", "nerd").codePointAt(0)).toBe(0xf01b4); // md-delete
    expect(icon("skip", "nerd").codePointAt(0)).toBe(0xf04ac); // md-skip_forward
    for (const key of ALL_KEYS) {
      expect(icon(key, "nerd").trim().length).toBeGreaterThan(0);
    }
  });

  test("plain style uses common-monospace Unicode (no shark glyph)", () => {
    expect(icon("check", "plain")).toBe("✓ ");
    expect(icon("cross", "plain")).toBe("✗ ");
    expect(icon("warn", "plain")).toBe("⚠ ");
    expect(icon("shark", "plain")).toBe("");
  });

  test("none style returns empty strings so no stray whitespace remains", () => {
    for (const key of ALL_KEYS) {
      expect(icon(key, "none")).toBe("");
    }
  });

  test("icon() follows DOCSHARK_ICONS when no style is passed", () => {
    expect(icon("check")).toBe("✅ ");
    process.env.DOCSHARK_ICONS = "none";
    expect(icon("check")).toBe("");
    process.env.DOCSHARK_ICONS = "plain";
    expect(icon("check")).toBe("✓ ");
  });
});
