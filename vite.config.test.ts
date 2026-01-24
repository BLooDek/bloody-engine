import { defineConfig } from "vite";
import path from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      include: ["src/visual-regression.test.ts"],
      outDir: "dist/test",
    }),
  ],
  mode: "production",
  build: {
    outDir: "dist/test",
    target: "node18",
    lib: {
      entry: path.resolve(__dirname, "src/visual-regression.test.ts"),
      formats: ["es"],
      fileName: () => "visual-regression.test.js",
    },
    rollupOptions: {
      external: ["gl", "@kmamal/sdl", "pngjs", "fs", "path"],
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
