/**
 * WebGL2 Renderer for high-performance shape rendering.
 * Handles batched rendering, layers, and shader management.
 */

import { mat3 } from 'gl-matrix';
import type { Viewport } from '../../types/core';

export interface RendererOptions {
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private viewport: Viewport;
  private programs: Map<string, WebGLProgram> = new Map();
  private vertexArrays: Map<string, WebGLVertexArrayObject> = new Map();

  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    this.canvas = canvas;
    
    const gl = canvas.getContext('webgl2', {
      antialias: options.antialias ?? true,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
      alpha: true,
      premultipliedAlpha: true,
    });

    if (!gl) {
      throw new Error('WebGL2 not supported');
    }

    this.gl = gl;
    this.viewport = {
      width: canvas.width,
      height: canvas.height,
      pixelRatio: window.devicePixelRatio || 1,
    };

    this.initialize();
  }

  private initialize(): void {
    const { gl } = this;

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Setup viewport
    gl.viewport(0, 0, this.viewport.width, this.viewport.height);

    // Initialize shaders
    this.initializeShaders();
  }

  private initializeShaders(): void {
    // Rectangle shader
    this.programs.set(
      'rectangle',
      this.createProgram(
        this.getRectangleVertexShader(),
        this.getRectangleFragmentShader()
      )
    );

    // Selection outline shader
    this.programs.set(
      'selection',
      this.createProgram(
        this.getSelectionVertexShader(),
        this.getSelectionFragmentShader()
      )
    );

    // Grid shader
    this.programs.set(
      'grid',
      this.createProgram(
        this.getGridVertexShader(),
        this.getGridFragmentShader()
      )
    );
  }

  private createShader(type: number, source: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${info}`);
    }

    return shader;
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const { gl } = this;
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking failed: ${info}`);
    }

    // Clean up shaders after linking
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  }

  /**
   * Clear the canvas.
   */
  clear(color: [number, number, number, number] = [0.95, 0.95, 0.95, 1]): void {
    const { gl } = this;
    gl.clearColor(...color);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * Resize the renderer viewport.
   */
  resize(width: number, height: number): void {
    const pixelRatio = window.devicePixelRatio || 1;
    this.viewport = { width, height, pixelRatio };

    this.canvas.width = width * pixelRatio;
    this.canvas.height = height * pixelRatio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render a rectangle shape.
   */
  renderRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    viewMatrix: mat3
  ): void {
    const { gl } = this;
    const program = this.programs.get('rectangle');
    if (!program) return;

    gl.useProgram(program);

    // Create or get vertex array for rectangle
    const vaoKey = 'rectangle';
    let vao = this.vertexArrays.get(vaoKey);

    if (!vao) {
      vao = this.createRectangleVAO();
      this.vertexArrays.set(vaoKey, vao);
    }

    gl.bindVertexArray(vao);

    // Set uniforms
    const uViewMatrix = gl.getUniformLocation(program, 'u_viewMatrix');
    const uModelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');
    const uViewport = gl.getUniformLocation(program, 'u_viewport');
    const uColor = gl.getUniformLocation(program, 'u_color');

    // Create model matrix for this rectangle
    const modelMatrix = mat3.create();
    mat3.translate(modelMatrix, modelMatrix, [x, y]);
    mat3.scale(modelMatrix, modelMatrix, [width, height]);

    gl.uniformMatrix3fv(uViewMatrix, false, viewMatrix);
    gl.uniformMatrix3fv(uModelMatrix, false, modelMatrix);
    gl.uniform2f(uViewport, this.viewport.width, this.viewport.height);

    // Parse color
    const rgba = this.parseColor(color);
    gl.uniform4fv(uColor, rgba);

    // Draw
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    gl.bindVertexArray(null);
  }

  /**
   * Render selection outline.
   */
  renderSelection(
    x: number,
    y: number,
    width: number,
    height: number,
    viewMatrix: mat3
  ): void {
    const { gl } = this;
    const program = this.programs.get('selection');
    if (!program) return;

    gl.useProgram(program);

    // Create selection outline geometry
    const vaoKey = 'selection';
    let vao = this.vertexArrays.get(vaoKey);

    if (!vao) {
      vao = this.createSelectionVAO();
      this.vertexArrays.set(vaoKey, vao);
    }

    gl.bindVertexArray(vao);

    // Set uniforms
    const uViewMatrix = gl.getUniformLocation(program, 'u_viewMatrix');
    const uModelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');
    const uViewport = gl.getUniformLocation(program, 'u_viewport');
    const uColor = gl.getUniformLocation(program, 'u_color');

    const modelMatrix = mat3.create();
    mat3.translate(modelMatrix, modelMatrix, [x, y]);
    mat3.scale(modelMatrix, modelMatrix, [width, height]);

    gl.uniformMatrix3fv(uViewMatrix, false, viewMatrix);
    gl.uniformMatrix3fv(uModelMatrix, false, modelMatrix);
    gl.uniform2f(uViewport, this.viewport.width, this.viewport.height);
    gl.uniform4fv(uColor, [0.2, 0.5, 1.0, 1.0]); // Blue selection

    // Draw outline
    gl.drawArrays(gl.LINE_LOOP, 0, 4);

    gl.bindVertexArray(null);
  }

  /**
   * Render background grid.
   */
  renderGrid(_viewMatrix: mat3, _zoom: number): void {
    const { gl } = this;
    const program = this.programs.get('grid');
    if (!program) return;

    gl.useProgram(program);

    // Grid rendering logic
    // TODO: Implement efficient grid rendering with proper spacing based on zoom
  }

  private createRectangleVAO(): WebGLVertexArrayObject {
    const { gl } = this;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');

    gl.bindVertexArray(vao);

    // Rectangle vertices (0,0 to 1,1 - scaled by model matrix)
    const vertices = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    return vao;
  }

  private createSelectionVAO(): WebGLVertexArrayObject {
    return this.createRectangleVAO(); // Same geometry as rectangle
  }

  private parseColor(color: string): Float32Array {
    // Simple color parser - supports hex colors
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      const a = hex.length > 6 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
      return new Float32Array([r, g, b, a]);
    }
    return new Float32Array([1, 1, 1, 1]);
  }

  // ============================================================================
  // Shader Sources
  // ============================================================================

  private getRectangleVertexShader(): string {
    return `#version 300 es
      precision highp float;

      layout(location = 0) in vec2 a_position;

      uniform mat3 u_viewMatrix;
      uniform mat3 u_modelMatrix;
      uniform vec2 u_viewport;

      void main() {
        vec3 pos = u_viewMatrix * u_modelMatrix * vec3(a_position, 1.0);

        // Convert to clip space
        vec2 clipSpace = (pos.xy / u_viewport) * 2.0 - 1.0;
        clipSpace.y = -clipSpace.y; // Flip Y for screen coordinates

        gl_Position = vec4(clipSpace, 0.0, 1.0);
      }
    `;
  }

  private getRectangleFragmentShader(): string {
    return `#version 300 es
      precision highp float;

      uniform vec4 u_color;
      out vec4 fragColor;

      void main() {
        fragColor = u_color;
      }
    `;
  }

  private getSelectionVertexShader(): string {
    return this.getRectangleVertexShader();
  }

  private getSelectionFragmentShader(): string {
    return this.getRectangleFragmentShader();
  }

  private getGridVertexShader(): string {
    return `#version 300 es
      precision highp float;

      layout(location = 0) in vec2 a_position;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
  }

  private getGridFragmentShader(): string {
    return `#version 300 es
      precision highp float;

      out vec4 fragColor;

      void main() {
        fragColor = vec4(0.8, 0.8, 0.8, 0.5);
      }
    `;
  }

  /**
   * Cleanup resources.
   */
  dispose(): void {
    this.programs.forEach((program) => this.gl.deleteProgram(program));
    this.vertexArrays.forEach((vao) => this.gl.deleteVertexArray(vao));
    this.programs.clear();
    this.vertexArrays.clear();
  }
}
