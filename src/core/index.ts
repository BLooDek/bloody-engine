/**
 * Bloody Engine - Resource Loader Demo (Browser Entry Point)
 *
 * This is the main browser entry point that demonstrates:
 * - Loading shader source code from external files
 * - Using ResourcePipeline for async resource management
 * - Caching and batch loading
 *
 * Run this in a browser with proper MIME type support for .vert and .frag files.
 * You may need to configure your web server to serve these files with the correct MIME types.
 */

import { runBrowserResourceLoaderDemo } from "../examples/resource-loader-demo";

// Guard to prevent double execution
const DEMO_STARTED_KEY = "__bloody_engine_demo_started__";

if (!(window as any)[DEMO_STARTED_KEY]) {
  (window as any)[DEMO_STARTED_KEY] = true;

  // Start the demo
  console.log("🩸 Starting Bloody Engine Resource Loader Demo...\n");

  runBrowserResourceLoaderDemo().catch((error) => {
    console.error("❌ Failed to start demo:", error);
    document.body.innerHTML = `
      <div style="color: white; font-family: monospace; padding: 20px;">
        <h1>❌ Demo Failed to Start</h1>
        <pre>${error}</pre>
        <p><strong>Note:</strong> This demo requires loading external shader files.</p>
        <p>Make sure your web server is configured to serve .vert and .frag files with MIME type <code>text/plain</code> or similar.</p>
      </div>
    `;
  });
}
