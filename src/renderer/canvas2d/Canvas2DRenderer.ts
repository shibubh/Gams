/**
 * Canvas2D Fallback Renderer.
 * Used when WebGL2 is not available.
 */

import type { Camera } from '../../types/core';

export class Canvas2DRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Canvas2D not supported');
    }
    this.ctx = ctx;
  }

  /**
   * Clear the canvas.
   */
  clear(color: string = '#f5f5f5'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Resize the canvas.
   */
  resize(width: number, height: number): void {
    const pixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = width * pixelRatio;
    this.canvas.height = height * pixelRatio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(pixelRatio, pixelRatio);
  }

  /**
   * Apply camera transform to context.
   */
  applyCamera(camera: Camera): void {
    const { ctx } = this;
    ctx.save();
    
    // Apply view matrix transform
    const m = camera.viewMatrix;
    ctx.setTransform(m[0], m[1], m[3], m[4], m[6], m[7]);
  }

  /**
   * Restore context state.
   */
  restore(): void {
    this.ctx.restore();
  }

  /**
   * Render a rectangle.
   */
  renderRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor?: string,
    strokeColor?: string,
    strokeWidth: number = 1
  ): void {
    const { ctx } = this;

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, width, height);
    }

    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeRect(x, y, width, height);
    }
  }

  /**
   * Render selection outline.
   */
  renderSelection(
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const { ctx } = this;
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, width, height);

    // Draw corner handles
    const handleSize = 6;
    const handles = [
      [x, y], // Top-left
      [x + width, y], // Top-right
      [x + width, y + height], // Bottom-right
      [x, y + height], // Bottom-left
    ];

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;

    handles.forEach(([hx, hy]) => {
      ctx.fillRect(
        hx - handleSize / 2,
        hy - handleSize / 2,
        handleSize,
        handleSize
      );
      ctx.strokeRect(
        hx - handleSize / 2,
        hy - handleSize / 2,
        handleSize,
        handleSize
      );
    });
  }

  /**
   * Render a guide line.
   */
  renderGuide(
    axis: 'x' | 'y',
    value: number,
    color: string = '#ff00ff'
  ): void {
    const { ctx } = this;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    if (axis === 'x') {
      ctx.moveTo(value, -100000);
      ctx.lineTo(value, 100000);
    } else {
      ctx.moveTo(-100000, value);
      ctx.lineTo(100000, value);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render background grid.
   */
  renderGrid(zoom: number, offsetX: number, offsetY: number): void {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;

    // Determine grid spacing based on zoom
    let gridSize = 50;
    if (zoom < 0.5) gridSize = 100;
    if (zoom > 2) gridSize = 25;
    if (zoom > 4) gridSize = 10;

    ctx.save();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    const startX = Math.floor(-offsetX / gridSize) * gridSize;
    const startY = Math.floor(-offsetY / gridSize) * gridSize;

    // Vertical lines
    for (let x = startX; x < width / zoom; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -offsetY);
      ctx.lineTo(x, height / zoom - offsetY);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = startY; y < height / zoom; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-offsetX, y);
      ctx.lineTo(width / zoom - offsetX, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render text.
   */
  renderText(
    text: string,
    x: number,
    y: number,
    fontSize: number = 16,
    fontFamily: string = 'Arial',
    color: string = '#000000'
  ): void {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillText(text, x, y);
  }

  /**
   * Render an ellipse.
   */
  renderEllipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    fillColor?: string,
    strokeColor?: string,
    strokeWidth: number = 1
  ): void {
    const { ctx } = this;

    ctx.beginPath();
    ctx.ellipse(x + radiusX, y + radiusY, radiusX, radiusY, 0, 0, 2 * Math.PI);

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }

  /**
   * Render a line.
   */
  renderLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string = '#000000',
    width: number = 1
  ): void {
    const { ctx } = this;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}
