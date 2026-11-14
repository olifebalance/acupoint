import { defineConfig } from 'vite';
// base './' so the built folder works from any path (a subfolder of the site, a preview link).
export default defineConfig({ base: './', build: { assetsInlineLimit: 0 } });
