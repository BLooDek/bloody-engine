import { defineConfig } from "vite";
import path from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      include: ["src/**/*"],
      outDir: "dist/web",
      insertTypesEntry: true,
    }),
  ],
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
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
