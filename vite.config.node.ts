import { defineConfig } from "vite";
import path from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      include: ["src/**/*"],
      exclude: ["src/**/*.test.ts", "src/tests/**/*"],
      outDir: "dist/node",
      insertTypesEntry: true,
    }),
  ],
  // Explicitly set to Node.js environment
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
      // Externalize graphics libraries - Node.js built-ins will be bundled
      external: ["gl", "@kmamal/sdl"],
      output: {
        format: "es",
        entryFileNames: "[name].js",
      },
    },
    // Ensure SSR build mode for Node.js
    ssr: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
