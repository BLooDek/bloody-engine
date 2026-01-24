import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  mode: "production",
  build: {
    outDir: "dist/demo",
    target: "node18",
    lib: {
      entry: path.resolve(__dirname, "src/demo-node.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["gl", "@kmamal/sdl", "pngjs"],
      output: {
        format: "es",
        entryFileNames: "[name].js",
      },
    },
    ssr: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
