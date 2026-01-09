/**
 * Grid Renderer - Renders infinite grid background
 */

import type { CameraState, Mat3 } from "../core/types";

const GRID_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
uniform mat3 u_matrix;

void main() {
  vec3 pos = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
}
`;

const GRID_FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 outColor;
uniform vec4 u_color;

void main() {
  outColor = u_color;
}
`;

export class GridRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.initShaders();
  }

  private initShaders(): void {
    const { gl } = this;

    // Create shaders
    const vertexShader = this.createShader(gl.VERTEX_SHADER, GRID_VERTEX_SHADER);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, GRID_FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return;

    // Create program
    this.program = gl.createProgram();
    if (!this.program) return;

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error("Grid shader program failed to link:", gl.getProgramInfoLog(this.program));
      return;
    }

    // Create VAO
    this.vao = gl.createVertexArray();
    this.buffer = gl.createBuffer();
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  render(camera: CameraState, cameraMatrix: Mat3): void {
    if (!this.program || !this.vao || !this.buffer) return;

    const { gl } = this;
    const { zoom, pan, viewportPx } = camera;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Get uniform locations
    const matrixLoc = gl.getUniformLocation(this.program, "u_matrix");
    const colorLoc = gl.getUniformLocation(this.program, "u_color");

    // Set uniforms
    gl.uniformMatrix3fv(matrixLoc, false, cameraMatrix);

    const gridSize = 50;
    const startX = Math.floor((pan.x - viewportPx.w / zoom) / gridSize) * gridSize;
    const endX = Math.ceil((pan.x + viewportPx.w / zoom) / gridSize) * gridSize;
    const startY = Math.floor((pan.y - viewportPx.h / zoom) / gridSize) * gridSize;
    const endY = Math.ceil((pan.y + viewportPx.h / zoom) / gridSize) * gridSize;

    // Render vertical lines
    const verticalLines: number[] = [];
    for (let x = startX; x <= endX; x += gridSize) {
      verticalLines.push(x, startY, x, endY);
    }

    if (verticalLines.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticalLines), gl.DYNAMIC_DRAW);

      const posLoc = gl.getAttribLocation(this.program, "a_position");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform4f(colorLoc, 0.89, 0.91, 0.94, 1.0); // #e2e8f0
      gl.drawArrays(gl.LINES, 0, verticalLines.length / 2);
    }

    // Render horizontal lines
    const horizontalLines: number[] = [];
    for (let y = startY; y <= endY; y += gridSize) {
      horizontalLines.push(startX, y, endX, y);
    }

    if (horizontalLines.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(horizontalLines), gl.DYNAMIC_DRAW);

      const posLoc = gl.getAttribLocation(this.program, "a_position");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform4f(colorLoc, 0.89, 0.91, 0.94, 1.0);
      gl.drawArrays(gl.LINES, 0, horizontalLines.length / 2);
    }
  }

  destroy(): void {
    const { gl } = this;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.buffer) gl.deleteBuffer(this.buffer);
  }
}
