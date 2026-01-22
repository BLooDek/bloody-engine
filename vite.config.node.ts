import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    outDir: "dist/node",
    target: "node18",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      external: ["gl"],
      output: {
        format: "es",
        entryFileNames: "[name].js",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
