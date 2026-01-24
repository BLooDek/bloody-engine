import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  mode: "production",
  build: {
    outDir: "dist/node",
    target: "node18",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["gl", "@kmamal/sdl"],
      output: {
        format: "es",
        entryFileNames: "[name].js",
      },
    },
    ssr: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
