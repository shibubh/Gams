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
    strokeWidth: number = 1,
    cornerRadius: number = 0
  ): void {
    const { ctx } = this;

    ctx.beginPath();

    if (cornerRadius > 0) {
      // Draw rounded rectangle
      const radius = Math.min(cornerRadius, width / 2, height / 2);
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    } else {
      // Draw regular rectangle
      ctx.rect(x, y, width, height);
    }

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    if (strokeColor && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
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
  }

  /**
   * Render resize handles on all corners and edges.
   */
  renderResizeHandles(
    x: number,
    y: number,
    width: number,
    height: number,
    zoom: number
  ): void {
    const { ctx } = this;

    // Handle size in screen space (consistent regardless of zoom)
    const handleSize = 8 / zoom;

    // Define handle positions (corners and mid-points)
    const handles = [
      // Corners
      { x: x, y: y }, // Top-left
      { x: x + width, y: y }, // Top-right
      { x: x, y: y + height }, // Bottom-left
      { x: x + width, y: y + height }, // Bottom-right
      // Mid-points
      { x: x + width / 2, y: y }, // Top-mid
      { x: x + width / 2, y: y + height }, // Bottom-mid
      { x: x, y: y + height / 2 }, // Left-mid
      { x: x + width, y: y + height / 2 }, // Right-mid
    ];

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / zoom;

    handles.forEach(handle => {
      ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
      ctx.strokeRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
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
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
    ctx.lineWidth = 1 / zoom;

    const startX = Math.floor(-offsetX / gridSize) * gridSize;
    const startY = Math.floor(-offsetY / gridSize) * gridSize;
    const endX = Math.ceil((width / zoom - offsetX) / gridSize) * gridSize;
    const endY = Math.ceil((height / zoom - offsetY) / gridSize) * gridSize;

    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -offsetY);
      ctx.lineTo(x, height / zoom - offsetY);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-offsetX, y);
      ctx.lineTo(width / zoom - offsetX, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render distance guide between two bounds
   */
  renderDistanceGuide(
    fromBounds: { x: number; y: number; width: number; height: number },
    toBounds: { x: number; y: number; width: number; height: number },
    direction: 'horizontal' | 'vertical',
    label: string,
    zoom: number
  ): void {
    const { ctx } = this;

    ctx.save();
    ctx.strokeStyle = '#ff00ff';
    ctx.fillStyle = '#ff00ff';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);

    if (direction === 'horizontal') {
      const fromX = fromBounds.x + fromBounds.width;
      const toX = toBounds.x;
      const centerY = (fromBounds.y + fromBounds.y + fromBounds.height) / 2;

      // Draw horizontal line
      ctx.beginPath();
      ctx.moveTo(fromX, centerY);
      ctx.lineTo(toX, centerY);
      ctx.stroke();

      // Draw end caps
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(fromX, centerY - 5 / zoom);
      ctx.lineTo(fromX, centerY + 5 / zoom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX, centerY - 5 / zoom);
      ctx.lineTo(toX, centerY + 5 / zoom);
      ctx.stroke();

      // Draw label
      const labelX = (fromX + toX) / 2;
      const labelY = centerY - 8 / zoom;
      ctx.font = `${12 / zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, labelX, labelY);
    } else {
      const fromY = fromBounds.y + fromBounds.height;
      const toY = toBounds.y;
      const centerX = (fromBounds.x + fromBounds.x + fromBounds.width) / 2;

      // Draw vertical line
      ctx.beginPath();
      ctx.moveTo(centerX, fromY);
      ctx.lineTo(centerX, toY);
      ctx.stroke();

      // Draw end caps
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(centerX - 5 / zoom, fromY);
      ctx.lineTo(centerX + 5 / zoom, fromY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX - 5 / zoom, toY);
      ctx.lineTo(centerX + 5 / zoom, toY);
      ctx.stroke();

      // Draw label
      const labelX = centerX + 8 / zoom;
      const labelY = (fromY + toY) / 2;
      ctx.font = `${12 / zoom}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX, labelY);
    }

    ctx.restore();
  }

  /**
   * Create diagonal stripe pattern (for margin/padding visualization)
   */
  private createDiagonalPattern(
    color: string,
    direction: 'ne' | 'se' = 'ne',
    zoom: number
  ): CanvasPattern | null {
    const { ctx } = this;
    
    // Create a small canvas for the pattern
    const patternCanvas = document.createElement('canvas');
    const patternSize = Math.max(8, 8 / zoom); // Keep pattern visible at different zoom levels
    patternCanvas.width = patternSize;
    patternCanvas.height = patternSize;
    
    const pctx = patternCanvas.getContext('2d');
    if (!pctx) return null;
    
    // Fill with transparent background
    pctx.clearRect(0, 0, patternSize, patternSize);
    
    // Draw diagonal lines
    pctx.strokeStyle = color;
    pctx.lineWidth = 1;
    
    if (direction === 'ne') {
      // Northeast direction (↗)
      for (let i = -patternSize; i < patternSize * 2; i += 4) {
        pctx.beginPath();
        pctx.moveTo(i, patternSize);
        pctx.lineTo(i + patternSize, 0);
        pctx.stroke();
      }
    } else {
      // Southeast direction (↘)
      for (let i = -patternSize; i < patternSize * 2; i += 4) {
        pctx.beginPath();
        pctx.moveTo(i, 0);
        pctx.lineTo(i + patternSize, patternSize);
        pctx.stroke();
      }
    }
    
    return ctx.createPattern(patternCanvas, 'repeat');
  }

  /**
   * Render a blue badge with text (for showing pixel values)
   */
  private renderBadge(
    text: string,
    x: number,
    y: number,
    zoom: number
  ): void {
    const { ctx } = this;
    
    const fontSize = Math.max(10, 10 / zoom);
    const padding = Math.max(4, 4 / zoom);
    const borderRadius = Math.max(3, 3 / zoom);
    
    ctx.save();
    ctx.font = `bold ${fontSize}px Arial`;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;
    
    const badgeWidth = textWidth + padding * 2;
    const badgeHeight = textHeight + padding * 2;
    
    // Draw rounded rectangle background
    ctx.fillStyle = '#3b82f6'; // Blue background
    ctx.beginPath();
    ctx.moveTo(x - badgeWidth / 2 + borderRadius, y - badgeHeight / 2);
    ctx.lineTo(x + badgeWidth / 2 - borderRadius, y - badgeHeight / 2);
    ctx.quadraticCurveTo(x + badgeWidth / 2, y - badgeHeight / 2, x + badgeWidth / 2, y - badgeHeight / 2 + borderRadius);
    ctx.lineTo(x + badgeWidth / 2, y + badgeHeight / 2 - borderRadius);
    ctx.quadraticCurveTo(x + badgeWidth / 2, y + badgeHeight / 2, x + badgeWidth / 2 - borderRadius, y + badgeHeight / 2);
    ctx.lineTo(x - badgeWidth / 2 + borderRadius, y + badgeHeight / 2);
    ctx.quadraticCurveTo(x - badgeWidth / 2, y + badgeHeight / 2, x - badgeWidth / 2, y + badgeHeight / 2 - borderRadius);
    ctx.lineTo(x - badgeWidth / 2, y - badgeHeight / 2 + borderRadius);
    ctx.quadraticCurveTo(x - badgeWidth / 2, y - badgeHeight / 2, x - badgeWidth / 2 + borderRadius, y - badgeHeight / 2);
    ctx.closePath();
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = '#ffffff'; // White text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    
    ctx.restore();
  }

  /**
   * Render margin visualization with diagonal stripe pattern
   */
  renderMargin(
    bounds: { x: number; y: number; width: number; height: number },
    margin: { t: number; r: number; b: number; l: number },
    zoom: number
  ): void {
    const { ctx } = this;

    ctx.save();
    
    // Blue diagonal stripes (↗ direction) for margin
    const pattern = this.createDiagonalPattern('rgba(96, 165, 250, 0.4)', 'ne', zoom);
    if (pattern) {
      ctx.fillStyle = pattern;
    } else {
      ctx.fillStyle = 'rgba(96, 165, 250, 0.2)';
    }

    // Top margin
    if (margin.t > 0) {
      ctx.fillRect(bounds.x, bounds.y - margin.t, bounds.width, margin.t);
      
      // Blue badge with pixel value
      this.renderBadge(
        `${Math.round(margin.t)}`,
        bounds.x + bounds.width / 2,
        bounds.y - margin.t / 2,
        zoom
      );
    }

    // Right margin
    if (margin.r > 0) {
      ctx.fillRect(bounds.x + bounds.width, bounds.y, margin.r, bounds.height);
      
      // Blue badge with pixel value
      this.renderBadge(
        `${Math.round(margin.r)}`,
        bounds.x + bounds.width + margin.r / 2,
        bounds.y + bounds.height / 2,
        zoom
      );
    }

    // Bottom margin
    if (margin.b > 0) {
      ctx.fillRect(bounds.x, bounds.y + bounds.height, bounds.width, margin.b);
      
      // Blue badge with pixel value
      this.renderBadge(
        `${Math.round(margin.b)}`,
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height + margin.b / 2,
        zoom
      );
    }

    // Left margin
    if (margin.l > 0) {
      ctx.fillRect(bounds.x - margin.l, bounds.y, margin.l, bounds.height);
      
      // Blue badge with pixel value
      this.renderBadge(
        `${Math.round(margin.l)}`,
        bounds.x - margin.l / 2,
        bounds.y + bounds.height / 2,
        zoom
      );
    }

    ctx.restore();
  }

  /**
   * Render padding visualization with diagonal stripe pattern
   */
  renderPadding(
    bounds: { x: number; y: number; width: number; height: number },
    padding: { t: number; r: number; b: number; l: number },
    zoom: number
  ): void {
    const { ctx } = this;

    ctx.save();
    
    // Pink diagonal stripes (↘ direction) for padding
    const pattern = this.createDiagonalPattern('rgba(236, 72, 153, 0.4)', 'se', zoom);
    if (pattern) {
      ctx.fillStyle = pattern;
    } else {
      ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
    }

    // Top padding
    if (padding.t > 0) {
      ctx.fillRect(bounds.x, bounds.y, bounds.width, padding.t);
      
      // Blue badge with pixel value
      this.renderBadge(
        `${Math.round(padding.t)}`,
        bounds.x + bounds.width / 2,
        bounds.y + padding.t / 2,
        zoom
      );
    }

    // Right padding
    if (padding.r > 0) {
      ctx.fillRect(bounds.x + bounds.width - padding.r, bounds.y, padding.r, bounds.height);
      
      // Blue badge with pixel value
      this.renderBadge(
        `${Math.round(padding.r)}`,
        bounds.x + bounds.width - padding.r / 2,
        bounds.y + bounds.height / 2,
        zoom
      );
    }

    // Bottom padding
    if (padding.b > 0) {
      ctx.fillRect(bounds.x, bounds.y + bounds.height - padding.b, bounds.width, padding.b);
      
      // Blue badge with pixel value
      this.renderBadge(
        `${Math.round(padding.b)}`,
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height - padding.b / 2,
        zoom
      );
    }

    // Left padding
    if (padding.l > 0) {
      ctx.fillRect(bounds.x, bounds.y, padding.l, bounds.height);
      
      // Blue badge with pixel value
      this.renderBadge(
        `${Math.round(padding.l)}`,
        bounds.x + padding.l / 2,
        bounds.y + bounds.height / 2,
        zoom
      );
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
