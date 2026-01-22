import sdl from "@kmamal/sdl";

/**
 * SDL Window wrapper for displaying rendered content
 * Handles window creation, event polling, and surface updates
 */
export class SDLWindow {
  private window: any;
  private width: number;
  private height: number;
  private title: string;
  private closed: boolean = false;

  constructor(width: number, height: number, title: string = "Bloody Engine") {
    this.width = width;
    this.height = height;
    this.title = title;

    try {
      // Create SDL window using sdl.video.createWindow
      this.window = sdl.video.createWindow({
        width: this.width,
        height: this.height,
        title: this.title,
      });

      if (!this.window) {
        throw new Error("Failed to create SDL window");
      }

      // Register close event to track window state
      this.window.on("close", () => {
        this.closed = true;
      });

      console.log(`✓ SDL Window created (${width}x${height}): "${title}"`);
    } catch (error) {
      this.cleanup();
      throw new Error(`Window creation failed: ${error}`);
    }
  }

  /**
   * Get window dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Display pixel data in the window
   * @param pixels Uint8Array of RGBA pixel data
   */
  updatePixels(pixels: Uint8Array): void {
    if (!this.window || this.closed) {
      return;
    }

    try {
      // Convert RGBA to the format SDL expects
      // sdl uses 'rgba32' format which is RGBA on little-endian systems
      const buffer = Buffer.from(pixels);
      const stride = this.width * 4; // 4 bytes per pixel (RGBA)

      // Render the buffer to the window
      this.window.render(this.width, this.height, stride, "rgba32", buffer);
    } catch (error) {
      console.error("Failed to update pixels:", error);
    }
  }

  /**
   * Register an event handler
   */
  on(eventName: string, handler: Function): void {
    if (!this.window || this.closed) {
      return;
    }

    try {
      this.window.on(eventName, (event: any) => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in ${eventName} handler:`, error);
        }
      });
    } catch (error) {
      console.error(`Error registering ${eventName} handler:`, error);
    }
  }

  /**
   * Check if window is still open
   */
  isOpen(): boolean {
    return this.window !== null && !this.closed;
  }

  /**
   * Cleanup and close window
   */
  cleanup(): void {
    if (this.window && !this.closed) {
      try {
        this.window.destroy();
      } catch (error) {
        console.warn("Error destroying window:", error);
      }
      this.window = null;
      this.closed = true;
    }

    console.log("✓ SDL Window cleaned up");
  }

  /**
   * Destroy the window (alias for cleanup)
   */
  destroy(): void {
    this.cleanup();
  }
}
