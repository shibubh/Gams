/**
 * Selection Renderer - Renders selection outlines
 */

import type { Mat3, ID, SceneNode } from "../core/types";

const SELECTION_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
uniform mat3 u_matrix;

void main() {
  vec3 pos = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
}
`;

const SELECTION_FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 outColor;
uniform vec4 u_color;

void main() {
  outColor = u_color;
}
`;

export class SelectionRenderer {
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

    const vertexShader = this.createShader(gl.VERTEX_SHADER, SELECTION_VERTEX_SHADER);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, SELECTION_FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return;

    this.program = gl.createProgram();
    if (!this.program) return;

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error("Selection shader program failed to link:", gl.getProgramInfoLog(this.program));
      return;
    }

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

  render(
    _camera: any,
    cameraMatrix: Mat3,
    selection: ID[],
    nodes: Record<ID, SceneNode>
  ): void {
    if (!this.program || !this.vao || !this.buffer) return;
    if (selection.length === 0) return;

    const { gl } = this;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const positions: number[] = [];

    for (const id of selection) {
      const node = nodes[id];
      if (!node) continue;

      const b = node.worldBounds;

      // Draw selection outline as line loop
      positions.push(
        b.x, b.y,
        b.x + b.w, b.y,
        b.x + b.w, b.y + b.h,
        b.x, b.y + b.h,
        b.x, b.y
      );
    }

    if (positions.length === 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const matrixLoc = gl.getUniformLocation(this.program, "u_matrix");
    gl.uniformMatrix3fv(matrixLoc, false, cameraMatrix);

    const colorLoc = gl.getUniformLocation(this.program, "u_color");
    gl.uniform4f(colorLoc, 0.23, 0.51, 0.96, 1.0); // #3b82f6

    gl.lineWidth(2);
    gl.drawArrays(gl.LINE_STRIP, 0, 5);
  }

  destroy(): void {
    const { gl } = this;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.buffer) gl.deleteBuffer(this.buffer);
  }
}
