import { GraphicsDevice, Camera, lerp, EntityManager, SpriteQuadInstance } from 'bloody-engine';
import { CONFIG } from '../utils/Constants.js';
import { HybridRenderer as GameHybridRenderer } from './HybridRenderer.js';

/**
 * Enemy configuration for rendering
 */
const ENEMY_RENDER_CONFIG: Record<string, { width: number; height: number; color: number[] }> = {
  'enemy_basic': { width: 32, height: 32, color: [1.0, 0.2, 0.2] },     // Red
  'enemy_fast': { width: 24, height: 24, color: [1.0, 0.6, 0.2] },      // Orange
  'enemy_tank': { width: 48, height: 48, color: [0.6, 0.2, 0.6] },      // Purple
};

/**
 * Renderer configuration options
 */
export interface RendererOptions {
  /** Use modern HybridRenderer with V5/V6 shaders (default: false for backward compatibility) */
  useHybridRenderer?: boolean;
  /** Enable debug rendering (default: false) */
  debug?: boolean;
  /** Instancing threshold for HybridRenderer (default: 100) */
  instancingThreshold?: number;
  /** Enable depth testing for HybridRenderer (default: true, set to false if you see rendering artifacts) */
  depthTestEnabled?: boolean;
}

/**
 * Simple Renderer - handles rendering with basic WebGL
 * Can optionally use HybridRenderer for modern GPU-based rendering
 */
export class Renderer {
  private gl: WebGLRenderingContext;
  private shaderProgram!: WebGLProgram;
  private positionLocation!: number;
  private colorLocation!: number;
  private viewMatrixLocation!: WebGLUniformLocation;
  private resolutionLocation!: WebGLUniformLocation;
  private tiltAngleLocation!: WebGLUniformLocation;
  private positionBuffer!: WebGLBuffer;
  private isReady: boolean = false;
  private tiltAngle: number = 0.3; // Default tilt angle (radians) - approximately 17 degrees

  // Modern renderer (optional)
  private hybridRenderer: GameHybridRenderer | null = null;
  private useHybrid: boolean = false;
  private frameCount: number = 0; // For debug logging

  constructor(
    private graphicsDevice: GraphicsDevice,
    private camera: Camera,
    options: RendererOptions = {}
  ) {
    this.gl = this.graphicsDevice.getGLContext();

    // Initialize modern renderer if requested
    if (options.useHybridRenderer) {
      this.useHybrid = true;

      // Log hybrid mode activation
      console.log('%c[Renderer] HybridRenderer mode ENABLED', 'color: #00ff00; font-weight: bold');
      console.log(`  Debug: ${options.debug ? 'ON' : 'OFF'}`);
      console.log(`  Instancing Threshold: ${options.instancingThreshold ?? 100}`);

      this.hybridRenderer = new GameHybridRenderer(graphicsDevice, camera, {
        debug: options.debug,
        instancingThreshold: options.instancingThreshold,
        depthTestEnabled: options.depthTestEnabled ?? false, // Default to false to avoid artifacts
      });
    } else {
      // Fall back to legacy renderer
      console.log('%c[Renderer] Using LEGACY renderer (basic WebGL)', 'color: #ffaa00; font-weight: bold');
      console.log('  Tip: Set useHybridRenderer: true for 100x performance improvement!');
      this.initShaders();
      this.initBuffers();
    }

    this.isReady = true;
  }

  private initShaders(): void {
    // Vertex shader with subtle 2.5D tilt effect
    const vsSource = `
      attribute vec2 aPosition;
      attribute vec3 aColor;

      uniform mat4 uViewMatrix;
      uniform vec2 uResolution;
      uniform float uTiltAngle;

      varying vec3 vColor;

      void main() {
        // Apply camera view matrix to get position relative to camera
        vec4 worldPos = vec4(aPosition, 0.0, 1.0);
        vec4 viewPos = uViewMatrix * worldPos;

        // Apply subtle tilt to Y for 2.5D effect
        // This compresses Y slightly to simulate viewing angle
        float tiltedY = viewPos.y * (1.0 - uTiltAngle * 0.15);

        // Convert to clip space (no depth scaling to avoid distortion)
        gl_Position = vec4(
          viewPos.x * 2.0 / uResolution.x,
          -tiltedY * 2.0 / uResolution.y,  // Flip Y for WebGL
          0.0,
          1.0
        );

        vColor = aColor;
      }
    `;

    // Simple fragment shader
    const fsSource = `
      precision mediump float;
      varying vec3 vColor;

      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `;

    // Compile shaders
    const vs = this.compileShader(this.gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource);

    // Create program
    this.shaderProgram = this.gl.createProgram()!;
    this.gl.attachShader(this.shaderProgram, vs);
    this.gl.attachShader(this.shaderProgram, fs);
    this.gl.linkProgram(this.shaderProgram);

    if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
      console.error('Shader program failed to link:', this.gl.getProgramInfoLog(this.shaderProgram));
      return;
    }

    // Get attribute and uniform locations
    this.positionLocation = this.gl.getAttribLocation(this.shaderProgram, 'aPosition');
    this.colorLocation = this.gl.getAttribLocation(this.shaderProgram, 'aColor');
    this.viewMatrixLocation = this.gl.getUniformLocation(this.shaderProgram, 'uViewMatrix')!;
    this.resolutionLocation = this.gl.getUniformLocation(this.shaderProgram, 'uResolution')!;
    this.tiltAngleLocation = this.gl.getUniformLocation(this.shaderProgram, 'uTiltAngle')!;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      throw new Error('Shader compilation failed');
    }

    return shader;
  }

  private initBuffers(): void {
    this.positionBuffer = this.gl.createBuffer()!;
  }

  /**
   * Clear the screen
   */
  clear(): void {
    this.graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
  }

  /**
   * Render grid lines on the ground
   */
  private renderGrid(): void {
    const gridSize = 100; // Grid spacing in pixels
    const gridColor = [0.15, 0.15, 0.2]; // Dark gray

    // Calculate visible grid range based on camera position
    const camX = this.camera.x;
    const camY = this.camera.y;
    const viewWidth = CONFIG.SCREEN_WIDTH;
    const viewHeight = CONFIG.SCREEN_HEIGHT;

    // Calculate grid boundaries (plus margin to avoid popping)
    const startX = Math.floor((camX - viewWidth / 2) / gridSize) * gridSize - gridSize;
    const endX = Math.ceil((camX + viewWidth / 2) / gridSize) * gridSize + gridSize;
    const startY = Math.floor((camY - viewHeight / 2) / gridSize) * gridSize - gridSize;
    const endY = Math.ceil((camY + viewHeight / 2) / gridSize) * gridSize + gridSize;

    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      const vertices = new Float32Array([
        x, startY, ...gridColor,
        x, endY, ...gridColor,
      ]);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

      this.gl.enableVertexAttribArray(this.positionLocation);
      this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 20, 0);

      this.gl.enableVertexAttribArray(this.colorLocation);
      this.gl.vertexAttribPointer(this.colorLocation, 3, this.gl.FLOAT, false, 20, 8);

      this.gl.drawArrays(this.gl.LINES, 0, 2);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      const vertices = new Float32Array([
        startX, y, ...gridColor,
        endX, y, ...gridColor,
      ]);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

      this.gl.enableVertexAttribArray(this.positionLocation);
      this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 20, 0);

      this.gl.enableVertexAttribArray(this.colorLocation);
      this.gl.vertexAttribPointer(this.colorLocation, 3, this.gl.FLOAT, false, 20, 8);

      this.gl.drawArrays(this.gl.LINES, 0, 2);
    }
  }

  /**
   * Render all entities
   */
  renderEntities(entityManager: EntityManager, alpha: number): void {
    if (!this.isReady) {
      return;
    }

    // Use HybridRenderer if enabled
    if (this.useHybrid && this.hybridRenderer) {
      this.renderEntitiesHybrid(entityManager, alpha);
      return;
    }

    // Legacy rendering path
    this.gl.useProgram(this.shaderProgram);

    // Set uniforms
    const viewMatrix = this.camera.getViewMatrix();
    this.gl.uniformMatrix4fv(this.viewMatrixLocation, false, viewMatrix);
    this.gl.uniform2f(this.resolutionLocation, CONFIG.SCREEN_WIDTH, CONFIG.SCREEN_HEIGHT);
    this.gl.uniform1f(this.tiltAngleLocation, this.tiltAngle);

    // Render grid first (behind everything)
    this.renderGrid();

    const entities = entityManager.getAllEntities();

    for (const entity of entities) {
      // Interpolate position
      const previousPos = entity.previousState.gridPos;
      const currentPos = entity.state.gridPos;

      const x = lerp(previousPos.xgrid, currentPos.xgrid, alpha);
      const y = lerp(previousPos.ygrid, currentPos.ygrid, alpha);

      // Determine size and color based on entity type
      let width = 64;
      let height = 64;
      let color = [0.2, 0.6, 1.0];

      if (entity.type === 'player') {
        width = 64;
        height = 64;
        color = [0.2, 0.6, 1.0]; // Blue
      } else if (entity.type.startsWith('enemy_')) {
        // Look up enemy config by type
        const config = ENEMY_RENDER_CONFIG[entity.type];
        if (config) {
          width = config.width;
          height = config.height;
          color = config.color;
        } else {
          // Default enemy rendering
          width = 32;
          height = 32;
          color = [1.0, 0.2, 0.2]; // Red
        }
      } else if (entity.type === 'projectile') {
        width = 16;
        height = 16;
        color = [1.0, 1.0, 0.2]; // Yellow
      } else if (entity.type === 'gem') {
        width = 16;
        height = 16;
        color = [0.2, 1.0, 0.4]; // Green
      }

      // Draw quad as two triangles
      const x1 = x - width / 2;
      const y1 = y - height / 2;
      const x2 = x + width / 2;
      const y2 = y + height / 2;

      const vertices = new Float32Array([
        x1, y1, ...color,
        x2, y1, ...color,
        x1, y2, ...color,
        x1, y2, ...color,
        x2, y1, ...color,
        x2, y2, ...color,
      ]);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

      // Set up attributes
      this.gl.enableVertexAttribArray(this.positionLocation);
      this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 20, 0);

      this.gl.enableVertexAttribArray(this.colorLocation);
      this.gl.vertexAttribPointer(this.colorLocation, 3, this.gl.FLOAT, false, 20, 8);

      // Draw
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }
  }

  /**
   * Present the rendered frame
   */
  present(): void {
    this.graphicsDevice.present();
  }

  /**
   * Render entities using HybridRenderer (modern GPU-based rendering)
   */
  private renderEntitiesHybrid(entityManager: EntityManager, alpha: number): void {
    if (!this.hybridRenderer) return;

    // Clear sprites from previous frame (screen already cleared by main loop)
    this.hybridRenderer.clearSprites();

    // Get all entities
    const entities = entityManager.getAllEntities();

    // Debug: Log frame info for first 100 frames (increased to catch flashing)
    if (this.frameCount < 100) {
      // Log entity types
      const types: Record<string, number> = {};
      for (const e of entities) {
        types[e.type] = (types[e.type] || 0) + 1;
      }

      // Log every frame to catch projectile spawning
      console.log(`[Renderer Frame ${this.frameCount}] 🎮 Entities: ${entities.length} total`, types);
      console.log(`  Alpha: ${alpha.toFixed(3)}`);
    }

    for (const entity of entities) {
      // Interpolate position
      const previousPos = entity.previousState.gridPos;
      const currentPos = entity.state.gridPos;

      const x = lerp(previousPos.xgrid, currentPos.xgrid, alpha);
      const y = lerp(previousPos.ygrid, currentPos.ygrid, alpha);
      const z = 0; // Z position defaults to 0 (could be enhanced with z-layering support)

      // Determine size and color based on entity type
      let width = 64;
      let height = 64;
      let color = { r: 0.2, g: 0.6, b: 1.0, a: 1.0 };

      if (entity.type === 'player') {
        width = 64;
        height = 64;
        color = { r: 0.2, g: 0.6, b: 1.0, a: 1.0 }; // Blue
      } else if (entity.type.startsWith('enemy_')) {
        // Look up enemy config by type
        const config = ENEMY_RENDER_CONFIG[entity.type];
        if (config) {
          width = config.width;
          height = config.height;
          color = { r: config.color[0], g: config.color[1], b: config.color[2], a: 1.0 };
        } else {
          // Default enemy rendering
          width = 32;
          height = 32;
          color = { r: 1.0, g: 0.2, b: 0.2, a: 1.0 }; // Red
        }
      } else if (entity.type === 'projectile') {
        width = 16;
        height = 16;
        color = { r: 1.0, g: 1.0, b: 0.2, a: 1.0 }; // Yellow
      } else if (entity.type === 'gem') {
        width = 16;
        height = 16;
        color = { r: 0.2, g: 1.0, b: 0.4, a: 1.0 }; // Green
      }

      // Add sprite to HybridRenderer
      this.hybridRenderer.addSprite({
        x,
        y,
        z,
        width,
        height,
        rotation: 0,
        color,
        texIndex: 0,
        gridX: x,
        gridY: y,
      });
    }

    // Increment frame counter for debug logging
    this.frameCount++;

    // Render all sprites
    this.hybridRenderer.render();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Clean up HybridRenderer if it was initialized
    if (this.hybridRenderer) {
      this.hybridRenderer.dispose();
      return;
    }

    // Clean up legacy renderer resources
    // Only delete if they were initialized (check if shaderProgram was set)
    if (this.shaderProgram) {
      this.gl.deleteProgram(this.shaderProgram);
    }
    if (this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
    }
  }

  /**
   * Check if renderer is ready
   */
  ready(): boolean {
    return this.isReady;
  }

  /**
   * Set the 2.5D tilt angle (0.0 = flat, 0.5 = strong perspective)
   */
  setTiltAngle(angle: number): void {
    this.tiltAngle = Math.max(0.0, Math.min(1.0, angle));
  }

  /**
   * Get the current tilt angle
   */
  getTiltAngle(): number {
    return this.tiltAngle;
  }

  /**
   * Check if HybridRenderer mode is enabled
   */
  isHybridMode(): boolean {
    return this.useHybrid;
  }

  /**
   * Get current rendering mode information
   */
  getRenderingMode(): {
    mode: 'hybrid' | 'legacy';
    details?: string;
  } {
    if (this.useHybrid && this.hybridRenderer) {
      const modeInfo = this.hybridRenderer.getCurrentRenderingMode();
      return {
        mode: 'hybrid',
        details: `Using ${modeInfo.mode.toUpperCase()} rendering (V5/V6 shaders)`,
      };
    }
    return {
      mode: 'legacy',
      details: 'Using basic WebGL rendering',
    };
  }

  /**
   * Print debug information to console
   */
  printDebugInfo(): void {
    const modeInfo = this.getRenderingMode();
    console.log(`%c[Renderer Debug]`, 'font-weight: bold; font-size: 14px');
    console.log(`  Mode: ${modeInfo.mode.toUpperCase()}`);
    console.log(`  Details: ${modeInfo.details}`);

    if (this.useHybrid && this.hybridRenderer) {
      console.log(this.hybridRenderer.getDebugInfo());
    }
  }
}
