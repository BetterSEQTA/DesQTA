import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import fs from 'fs';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Custom plugin to import CSS as text
function cssAsText() {
  return {
    name: 'css-as-text',
    load(id) {
      if (id.endsWith('.css?text')) {
        const cssPath = id.replace('?text', '');
        const css = fs.readFileSync(cssPath, 'utf-8');
        return `export default ${JSON.stringify(css)}`;
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [sveltekit(), cssAsText()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*', 'TAURI_'],
}));
