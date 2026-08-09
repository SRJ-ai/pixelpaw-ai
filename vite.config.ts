/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Tauri expects a fixed dev-server port and does not want Vite clearing the screen.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Prevent Vite from obscuring Rust errors.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    // Tauri watches the Rust side; don't let Vite watch it too.
    watch: { ignored: ["**/src-tauri/**"] },
  },
  // Produce assets compatible with the WebView2 target.
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
  },
  test: {
    // jsdom gives the settings/memory modules a real localStorage.
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
