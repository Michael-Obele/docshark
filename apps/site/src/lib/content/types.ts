import type { Component } from "svelte";

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
  route: string;
  section?: string;
  readingTime?: string;
  highlights?: string[];
}

export interface NavItem {
  href: string;
  label: string;
  icon: Component;
}

export interface FrontmatterMeta {
  title?: string;
  description?: string;
  order?: number;
  section?: string;
  readingTime?: string;
}
