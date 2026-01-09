/**
 * Rectangle Renderer - Renders rectangle shapes with batching
 */

import type { Mat3, SceneNode } from "../core/types";

const RECT_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in vec4 a_color;

uniform mat3 u_matrix;

out vec4 v_color;

void main() {
  vec3 pos = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
  v_color = a_color;
}
`;

const RECT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 outColor;

void main() {
  outColor = v_color;
}
`;

export class RectRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.initShaders();
  }

  private initShaders(): void {
    const { gl } = this;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, RECT_VERTEX_SHADER);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, RECT_FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return;

    this.program = gl.createProgram();
    if (!this.program) return;

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error("Rect shader program failed to link:", gl.getProgramInfoLog(this.program));
      return;
    }

    this.vao = gl.createVertexArray();
    this.positionBuffer = gl.createBuffer();
    this.colorBuffer = gl.createBuffer();
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

  renderBatch(
    cameraMatrix: Mat3,
    nodes: (SceneNode & { type: "rect" })[]
  ): void {
    if (!this.program || !this.vao || !this.positionBuffer || !this.colorBuffer) return;
    if (nodes.length === 0) return;

    const { gl } = this;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Build vertex data
    const positions: number[] = [];
    const colors: number[] = [];

    for (const node of nodes) {
      const { worldBounds: b, style } = node;
      
      // Parse fill color
      const fillColor = this.parseColor(style.fill || "#3b82f6");

      // Two triangles per rectangle
      // Triangle 1: top-left, top-right, bottom-left
      // Triangle 2: top-right, bottom-right, bottom-left
      
      positions.push(
        b.x, b.y,
        b.x + b.w, b.y,
        b.x, b.y + b.h,
        b.x + b.w, b.y,
        b.x + b.w, b.y + b.h,
        b.x, b.y + b.h
      );

      // Repeat color for each vertex
      for (let i = 0; i < 6; i++) {
        colors.push(...fillColor);
      }
    }

    // Upload position data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Upload color data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);

    const colorLoc = gl.getAttribLocation(this.program, "a_color");
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);

    // Set matrix uniform
    const matrixLoc = gl.getUniformLocation(this.program, "u_matrix");
    gl.uniformMatrix3fv(matrixLoc, false, cameraMatrix);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);

    // Render strokes if needed
    this.renderStrokes(cameraMatrix, nodes);
  }

  private renderStrokes(
    cameraMatrix: Mat3,
    nodes: (SceneNode & { type: "rect" })[]
  ): void {
    const { gl } = this;
    if (!this.program || !this.positionBuffer || !this.colorBuffer) return;

    const positions: number[] = [];
    const colors: number[] = [];

    for (const node of nodes) {
      if (!node.style.stroke) continue;

      const { worldBounds: b, style } = node;
      const strokeColor = this.parseColor(style.stroke || "#000000");

      // Line loop for rectangle outline
      positions.push(
        b.x, b.y,
        b.x + b.w, b.y,
        b.x + b.w, b.y + b.h,
        b.x, b.y + b.h,
        b.x, b.y
      );

      for (let i = 0; i < 5; i++) {
        colors.push(...strokeColor);
      }
    }

    if (positions.length === 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);

    const colorLoc = gl.getAttribLocation(this.program, "a_color");
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);

    const matrixLoc = gl.getUniformLocation(this.program, "u_matrix");
    gl.uniformMatrix3fv(matrixLoc, false, cameraMatrix);

    gl.drawArrays(gl.LINE_STRIP, 0, 5);
  }

  private parseColor(color: string): number[] {
    // Simple hex color parser
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return [r, g, b, 1.0];
    }
    return [0.5, 0.5, 0.5, 1.0];
  }

  destroy(): void {
    const { gl } = this;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.colorBuffer) gl.deleteBuffer(this.colorBuffer);
  }
}
