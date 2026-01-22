import { defineConfig } from "vite";
import path from "path";

// Default config for dev mode - targets web
export default defineConfig({
  build: {
    outDir: "dist/web",
    target: "es2020",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
