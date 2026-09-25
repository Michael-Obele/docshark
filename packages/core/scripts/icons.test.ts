/// <reference types="bun" />

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  DEFAULT_ICON_STYLE,
  getIconStyle,
  icon,
  readIconStyleFromConfig,
  writeIconStyle,
} from "../src/icons.js";

const tempDirs: string[] = [];

/** Point the config lookup at a fresh temp dir so tests never read ~/.docshark. */
function isolateConfig(): void {
  const dir = mkdtempSync(join(tmpdir(), "docshark-icons-"));
  tempDirs.push(dir);
  process.env.DOCSHARK_DATA_DIR = dir;
}

beforeEach(() => {
  // Never inherit the shell's DOCSHARK_ICONS / data dir into a test.
  delete process.env.DOCSHARK_ICONS;
  delete process.env.DOCSHARK_DATA_DIR;
});

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
  delete process.env.DOCSHARK_DATA_DIR;
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("icon styles", () => {
  test("getIconStyle defaults to plain and resolves DOCSHARK_ICONS", () => {
    isolateConfig();
    expect(DEFAULT_ICON_STYLE).toBe("plain");
    expect(getIconStyle()).toBe("plain");

    process.env.DOCSHARK_ICONS = "nerd";
    expect(getIconStyle()).toBe("nerd");

    process.env.DOCSHARK_ICONS = "  PLAIN  ";
    expect(getIconStyle()).toBe("plain");

    process.env.DOCSHARK_ICONS = "none";
    expect(getIconStyle()).toBe("none");

    process.env.DOCSHARK_ICONS = "not-a-style"; // warns once, falls through
    expect(getIconStyle()).toBe("plain");
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

  test("plain style uses common-monospace Unicode, emoji-falling-back for the shark", () => {
    expect(icon("check", "plain")).toBe("✓ ");
    expect(icon("cross", "plain")).toBe("✗ ");
    expect(icon("warn", "plain")).toBe("⚠ ");
    expect(icon("shark", "plain")).toBe("🦈 "); // missing glyph → emoji fallback
  });

  test("none style returns empty strings so no stray whitespace remains", () => {
    for (const key of ALL_KEYS) {
      expect(icon(key, "none")).toBe("");
    }
  });

  test("icon() follows DOCSHARK_ICONS when no style is passed", () => {
    isolateConfig();
    expect(icon("check")).toBe("✓ "); // default style: plain
    process.env.DOCSHARK_ICONS = "none";
    expect(icon("check")).toBe("");
    process.env.DOCSHARK_ICONS = "emoji";
    expect(icon("check")).toBe("✅ ");
  });
});

describe("icon config file", () => {
  test("writeIconStyle persists and getIconStyle reads it back", () => {
    isolateConfig();
    expect(readIconStyleFromConfig()).toBeNull();

    writeIconStyle("nerd");
    expect(readIconStyleFromConfig()).toBe("nerd");
    expect(getIconStyle()).toBe("nerd");
  });

  test("DOCSHARK_ICONS env beats the config file", () => {
    isolateConfig();
    writeIconStyle("nerd");
    process.env.DOCSHARK_ICONS = "emoji";
    expect(getIconStyle()).toBe("emoji");
  });

  test("invalid config value falls back to default; other keys survive writes", () => {
    isolateConfig();
    const configPath = join(process.env.DOCSHARK_DATA_DIR!, "config.json");
    writeFileSync(configPath, JSON.stringify({ icons: "bogus", keep: 1 }));
    expect(readIconStyleFromConfig()).toBeNull();
    expect(getIconStyle()).toBe("plain");

    writeIconStyle("plain");
    const saved = JSON.parse(readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    expect(saved.keep).toBe(1);
    expect(saved.icons).toBe("plain");
  });
});
