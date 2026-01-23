import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    outDir: "dist/web",
    target: "es2020",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "BloodyEngine",
      formats: ["es", "umd"],
      fileName: (format) => `index.${format === "es" ? "js" : "umd.js"}`,
    },
    rollupOptions: {
      // Externalize Node.js-only dependencies for browser builds
      external: [
        "@kmamal/sdl",
        "gl",
        "fs",
        "fs/promises",
        "path",
        "os",
        "events",
        "child_process",
      ],
      output: {
        globals: {},
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
