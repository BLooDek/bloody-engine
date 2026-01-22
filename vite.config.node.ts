import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    outDir: "dist/node",
    target: "node18",
    lib: {
      entry: path.resolve(__dirname, "src/index-node.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      // Keep Node.js dependencies external for Node builds
      external: ["gl", "@kmamal/sdl", "fs", "path", "os", "child_process"],
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
