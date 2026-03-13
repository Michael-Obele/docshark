// Type declarations for mdsvex markdown imports
// Markdown files are processed by mdsvex and exported as Svelte components
declare module "*.md" {
  let component: any;
  export default component;
  export const metadata: Record<string, any>;
}

declare module "*.svx" {
  let component: any;
  export default component;
  export const metadata: Record<string, any>;
}
