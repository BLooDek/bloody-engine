import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  // Explicitly set to Node.js environment
  mode: "production",
  build: {
    outDir: "dist/node",
    target: "node18",
    lib: {
      entry: path.resolve(__dirname, "src/index-node.ts"),
      formats: ["es"],
      fileName: () => "index-node.js",
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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
