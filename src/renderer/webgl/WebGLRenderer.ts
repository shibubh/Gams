/**
 * WebGL2 Renderer for high-performance shape rendering.
 * Handles batched rendering, layers, and shader management.
 */

import { mat3, vec2 } from 'gl-matrix';
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

    // Ellipse shader
    this.programs.set(
      'ellipse',
      this.createProgram(
        this.getEllipseVertexShader(),
        this.getEllipseFragmentShader()
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

    // Line shader (for visual guides)
    this.programs.set(
      'line',
      this.createProgram(
        this.getLineVertexShader(),
        this.getLineFragmentShader()
      )
    );

    // Text shader (for labels)
    this.programs.set(
      'text',
      this.createProgram(
        this.getTextVertexShader(),
        this.getTextFragmentShader()
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
   * Render an ellipse shape.
   */
  renderEllipse(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    viewMatrix: mat3
  ): void {
    const { gl } = this;
    const program = this.programs.get('ellipse');
    if (!program) return;

    gl.useProgram(program);

    // Create or get vertex array for ellipse
    const vaoKey = 'ellipse';
    let vao = this.vertexArrays.get(vaoKey);

    if (!vao) {
      vao = this.createEllipseVAO();
      this.vertexArrays.set(vaoKey, vao);
    }

    gl.bindVertexArray(vao);

    // Set uniforms
    const uViewMatrix = gl.getUniformLocation(program, 'u_viewMatrix');
    const uModelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');
    const uViewport = gl.getUniformLocation(program, 'u_viewport');
    const uColor = gl.getUniformLocation(program, 'u_color');

    // Create model matrix for this ellipse
    const modelMatrix = mat3.create();
    mat3.translate(modelMatrix, modelMatrix, [x, y]);
    mat3.scale(modelMatrix, modelMatrix, [width, height]);

    gl.uniformMatrix3fv(uViewMatrix, false, viewMatrix);
    gl.uniformMatrix3fv(uModelMatrix, false, modelMatrix);
    gl.uniform2f(uViewport, this.viewport.width, this.viewport.height);

    // Parse color
    const rgba = this.parseColor(color);
    gl.uniform4fv(uColor, rgba);

    // Draw ellipse
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

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
   * Render resize handles on all corners and edges.
   */
  renderResizeHandles(
    x: number,
    y: number,
    width: number,
    height: number,
    viewMatrix: mat3,
    zoom: number
  ): void {
    const { gl } = this;
    const program = this.programs.get('selection');
    if (!program) return;

    gl.useProgram(program);

    // Handle size in world space (should be consistent size regardless of zoom)
    const handleSize = 8 / zoom; // 8 pixels in screen space

    // Define handle positions (corners and mid-points)
    const handles = [
      // Corners
      { x: x - handleSize/2, y: y - handleSize/2 }, // Top-left
      { x: x + width - handleSize/2, y: y - handleSize/2 }, // Top-right
      { x: x - handleSize/2, y: y + height - handleSize/2 }, // Bottom-left
      { x: x + width - handleSize/2, y: y + height - handleSize/2 }, // Bottom-right
      // Mid-points
      { x: x + width/2 - handleSize/2, y: y - handleSize/2 }, // Top-mid
      { x: x + width/2 - handleSize/2, y: y + height - handleSize/2 }, // Bottom-mid
      { x: x - handleSize/2, y: y + height/2 - handleSize/2 }, // Left-mid
      { x: x + width - handleSize/2, y: y + height/2 - handleSize/2 }, // Right-mid
    ];

    // Get VAO for rectangle (handles are small rectangles)
    const vaoKey = 'rectangle';
    const vao = this.vertexArrays.get(vaoKey);
    if (!vao) return;

    gl.bindVertexArray(vao);

    // Set uniforms
    const uViewMatrix = gl.getUniformLocation(program, 'u_viewMatrix');
    const uModelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');
    const uViewport = gl.getUniformLocation(program, 'u_viewport');
    const uColor = gl.getUniformLocation(program, 'u_color');

    gl.uniformMatrix3fv(uViewMatrix, false, viewMatrix);
    gl.uniform2f(uViewport, this.viewport.width, this.viewport.height);
    gl.uniform4fv(uColor, [1.0, 1.0, 1.0, 1.0]); // White handles

    // Draw each handle
    handles.forEach(handle => {
      const modelMatrix = mat3.create();
      mat3.translate(modelMatrix, modelMatrix, [handle.x, handle.y]);
      mat3.scale(modelMatrix, modelMatrix, [handleSize, handleSize]);

      gl.uniformMatrix3fv(uModelMatrix, false, modelMatrix);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    });

    // Draw handle outlines
    gl.uniform4fv(uColor, [0.2, 0.5, 1.0, 1.0]); // Blue outline
    handles.forEach(handle => {
      const modelMatrix = mat3.create();
      mat3.translate(modelMatrix, modelMatrix, [handle.x, handle.y]);
      mat3.scale(modelMatrix, modelMatrix, [handleSize, handleSize]);

      gl.uniformMatrix3fv(uModelMatrix, false, modelMatrix);
      gl.drawArrays(gl.LINE_LOOP, 0, 4);
    });

    gl.bindVertexArray(null);
  }

  /**
   * Render background grid.
   */
  renderGrid(viewMatrix: mat3, zoom: number): void {
    const { gl } = this;
    const program = this.programs.get('line');
    if (!program) return;

    gl.useProgram(program);

    // Determine grid spacing based on zoom
    let gridSize = 50;
    if (zoom < 0.5) gridSize = 100;
    if (zoom > 2) gridSize = 25;
    if (zoom > 4) gridSize = 10;

    const width = this.viewport.width;
    const height = this.viewport.height;

    // Calculate world bounds from view matrix
    const invView = mat3.create();
    mat3.invert(invView, viewMatrix);
    
    const topLeft = vec2.fromValues(0, 0);
    const bottomRight = vec2.fromValues(width, height);
    vec2.transformMat3(topLeft, topLeft, invView);
    vec2.transformMat3(bottomRight, bottomRight, invView);

    const startX = Math.floor(topLeft[0] / gridSize) * gridSize;
    const endX = Math.ceil(bottomRight[0] / gridSize) * gridSize;
    const startY = Math.floor(topLeft[1] / gridSize) * gridSize;
    const endY = Math.ceil(bottomRight[1] / gridSize) * gridSize;

    // Render vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      this.renderLine(x, startY, x, endY, 'rgba(200, 200, 200, 0.3)', 1, viewMatrix);
    }

    // Render horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      this.renderLine(startX, y, endX, y, 'rgba(200, 200, 200, 0.3)', 1, viewMatrix);
    }
  }

  /**
   * Render a line
   */
  renderLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width: number,
    viewMatrix: mat3
  ): void {
    const { gl } = this;
    const program = this.programs.get('line');
    if (!program) return;

    gl.useProgram(program);

    // Create line vertices
    const vertices = new Float32Array([x1, y1, x2, y2]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms
    const uViewMatrix = gl.getUniformLocation(program, 'u_viewMatrix');
    const uViewport = gl.getUniformLocation(program, 'u_viewport');
    const uColor = gl.getUniformLocation(program, 'u_color');

    gl.uniformMatrix3fv(uViewMatrix, false, viewMatrix);
    gl.uniform2f(uViewport, this.viewport.width, this.viewport.height);
    
    const rgba = this.parseColorRGBA(color);
    gl.uniform4fv(uColor, rgba);

    gl.lineWidth(width);
    gl.drawArrays(gl.LINES, 0, 2);

    gl.deleteBuffer(buffer);
  }

  /**
   * Render distance guide
   */
  renderDistanceGuide(
    fromBounds: { x: number; y: number; width: number; height: number },
    toBounds: { x: number; y: number; width: number; height: number },
    direction: 'horizontal' | 'vertical',
    label: string,
    viewMatrix: mat3,
    zoom: number
  ): void {
    if (direction === 'horizontal') {
      const fromX = fromBounds.x + fromBounds.width;
      const toX = toBounds.x;
      const centerY = (fromBounds.y + fromBounds.y + fromBounds.height) / 2;

      // Main line
      this.renderDashedLine(fromX, centerY, toX, centerY, '#ff00ff', 1, viewMatrix);

      // End caps
      this.renderLine(fromX, centerY - 5 / zoom, fromX, centerY + 5 / zoom, '#ff00ff', 1, viewMatrix);
      this.renderLine(toX, centerY - 5 / zoom, toX, centerY + 5 / zoom, '#ff00ff', 1, viewMatrix);

      // Label (rendered as a small rectangle for now - proper text would need texture atlas)
      const labelX = (fromX + toX) / 2;
      const labelY = centerY - 8 / zoom;
      this.renderTextLabel(label, labelX, labelY, viewMatrix, zoom);
    } else {
      const fromY = fromBounds.y + fromBounds.height;
      const toY = toBounds.y;
      const centerX = (fromBounds.x + fromBounds.x + fromBounds.width) / 2;

      // Main line
      this.renderDashedLine(centerX, fromY, centerX, toY, '#ff00ff', 1, viewMatrix);

      // End caps
      this.renderLine(centerX - 5 / zoom, fromY, centerX + 5 / zoom, fromY, '#ff00ff', 1, viewMatrix);
      this.renderLine(centerX - 5 / zoom, toY, centerX + 5 / zoom, toY, '#ff00ff', 1, viewMatrix);

      // Label
      const labelX = centerX + 8 / zoom;
      const labelY = (fromY + toY) / 2;
      this.renderTextLabel(label, labelX, labelY, viewMatrix, zoom);
    }
  }

  /**
   * Render dashed line (approximation using multiple segments)
   */
  private renderDashedLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width: number,
    viewMatrix: mat3
  ): void {
    const dashLength = 4;
    const gapLength = 4;
    const totalLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const dx = (x2 - x1) / totalLength;
    const dy = (y2 - y1) / totalLength;

    let currentLength = 0;
    let isDash = true;

    while (currentLength < totalLength) {
      const segmentLength = isDash ? dashLength : gapLength;
      const endLength = Math.min(currentLength + segmentLength, totalLength);

      if (isDash) {
        const sx = x1 + dx * currentLength;
        const sy = y1 + dy * currentLength;
        const ex = x1 + dx * endLength;
        const ey = y1 + dy * endLength;
        this.renderLine(sx, sy, ex, ey, color, width, viewMatrix);
      }

      currentLength = endLength;
      isDash = !isDash;
    }
  }

  /**
   * Render margin visualization
   */
  renderMargin(
    bounds: { x: number; y: number; width: number; height: number },
    margin: { t: number; r: number; b: number; l: number },
    viewMatrix: mat3,
    zoom: number
  ): void {
    const color = 'rgba(255, 200, 100, 0.2)';
    const borderColor = 'rgba(255, 150, 50, 0.5)';

    // Top margin
    if (margin.t > 0) {
      this.renderRectangle(
        bounds.x,
        bounds.y - margin.t,
        bounds.width,
        margin.t,
        color,
        viewMatrix
      );
      this.renderDashedLine(
        bounds.x,
        bounds.y - margin.t,
        bounds.x + bounds.width,
        bounds.y - margin.t,
        borderColor,
        1,
        viewMatrix
      );
    }

    // Right margin
    if (margin.r > 0) {
      this.renderRectangle(
        bounds.x + bounds.width,
        bounds.y,
        margin.r,
        bounds.height,
        color,
        viewMatrix
      );
    }

    // Bottom margin
    if (margin.b > 0) {
      this.renderRectangle(
        bounds.x,
        bounds.y + bounds.height,
        bounds.width,
        margin.b,
        color,
        viewMatrix
      );
    }

    // Left margin
    if (margin.l > 0) {
      this.renderRectangle(
        bounds.x - margin.l,
        bounds.y,
        margin.l,
        bounds.height,
        color,
        viewMatrix
      );
    }
  }

  /**
   * Render padding visualization
   */
  renderPadding(
    bounds: { x: number; y: number; width: number; height: number },
    padding: { t: number; r: number; b: number; l: number },
    viewMatrix: mat3,
    zoom: number
  ): void {
    const color = 'rgba(100, 200, 255, 0.2)';

    // Top padding
    if (padding.t > 0) {
      this.renderRectangle(bounds.x, bounds.y, bounds.width, padding.t, color, viewMatrix);
    }

    // Right padding
    if (padding.r > 0) {
      this.renderRectangle(
        bounds.x + bounds.width - padding.r,
        bounds.y,
        padding.r,
        bounds.height,
        color,
        viewMatrix
      );
    }

    // Bottom padding
    if (padding.b > 0) {
      this.renderRectangle(
        bounds.x,
        bounds.y + bounds.height - padding.b,
        bounds.width,
        padding.b,
        color,
        viewMatrix
      );
    }

    // Left padding
    if (padding.l > 0) {
      this.renderRectangle(bounds.x, bounds.y, padding.l, bounds.height, color, viewMatrix);
    }
  }

  /**
   * Render text label (simplified - just a background for now)
   */
  private renderTextLabel(
    text: string,
    x: number,
    y: number,
    viewMatrix: mat3,
    zoom: number
  ): void {
    // For now, just render a small background rectangle
    // Proper text rendering would require a texture atlas
    const width = text.length * 6 / zoom;
    const height = 12 / zoom;
    this.renderRectangle(x - width / 2, y, width, height, 'rgba(255, 0, 255, 0.8)', viewMatrix);
  }

  /**
   * Parse RGBA color string
   */
  private parseColorRGBA(color: string): Float32Array {
    if (color.startsWith('rgba(')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
      if (match) {
        const r = parseInt(match[1]) / 255;
        const g = parseInt(match[2]) / 255;
        const b = parseInt(match[3]) / 255;
        const a = match[4] ? parseFloat(match[4]) : 1;
        return new Float32Array([r, g, b, a]);
      }
    }
    return this.parseColor(color);
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

  private createEllipseVAO(): WebGLVertexArrayObject {
    const { gl } = this;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');

    gl.bindVertexArray(vao);

    // Ellipse vertices (0,0 to 1,1 - scaled by model matrix)
    // Will use fragment shader to render ellipse shape
    const vertices = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    return vao;
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

  private getEllipseVertexShader(): string {
    return `#version 300 es
      precision highp float;

      layout(location = 0) in vec2 a_position;

      uniform mat3 u_viewMatrix;
      uniform mat3 u_modelMatrix;
      uniform vec2 u_viewport;

      out vec2 v_texCoord;

      void main() {
        vec3 pos = u_viewMatrix * u_modelMatrix * vec3(a_position, 1.0);

        // Convert to clip space
        vec2 clipSpace = (pos.xy / u_viewport) * 2.0 - 1.0;
        clipSpace.y = -clipSpace.y; // Flip Y for screen coordinates

        gl_Position = vec4(clipSpace, 0.0, 1.0);
        v_texCoord = a_position; // Pass through for ellipse calc
      }
    `;
  }

  private getEllipseFragmentShader(): string {
    return `#version 300 es
      precision highp float;

      in vec2 v_texCoord;
      uniform vec4 u_color;

      out vec4 fragColor;

      void main() {
        // Calculate ellipse using distance from center
        vec2 center = vec2(0.5, 0.5);
        vec2 delta = (v_texCoord - center) * 2.0; // Normalize to -1..1
        
        float dist = length(delta);
        
        // Antialiased edge
        float alpha = smoothstep(1.0, 0.98, dist);
        
        fragColor = vec4(u_color.rgb, u_color.a * alpha);
      }
    `;
  }

  private getLineVertexShader(): string {
    return `#version 300 es
      precision highp float;

      layout(location = 0) in vec2 a_position;

      uniform mat3 u_viewMatrix;
      uniform vec2 u_viewport;

      void main() {
        vec3 pos = u_viewMatrix * vec3(a_position, 1.0);

        // Convert to clip space
        vec2 clipSpace = (pos.xy / u_viewport) * 2.0 - 1.0;
        clipSpace.y = -clipSpace.y; // Flip Y for screen coordinates

        gl_Position = vec4(clipSpace, 0.0, 1.0);
      }
    `;
  }

  private getLineFragmentShader(): string {
    return `#version 300 es
      precision highp float;

      uniform vec4 u_color;
      out vec4 fragColor;

      void main() {
        fragColor = u_color;
      }
    `;
  }

  private getTextVertexShader(): string {
    return this.getRectangleVertexShader();
  }

  private getTextFragmentShader(): string {
    return this.getRectangleFragmentShader();
  }
}
