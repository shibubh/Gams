/**
 * Camera system for infinite canvas.
 * Handles viewport transforms, pan, zoom, and coordinate conversions.
 */

import { mat3, vec2 } from 'gl-matrix';
import type { Camera, Viewport } from '../types/core';

export class CameraController {
  private camera: Camera;
  private viewport: Viewport;

  constructor(viewport: Viewport) {
    this.viewport = viewport;
    this.camera = {
      position: vec2.fromValues(0, 0),
      zoom: 1.0,
      viewMatrix: mat3.create(),
      inverseViewMatrix: mat3.create(),
    };
    this.updateMatrices();
  }

  /**
   * Update camera matrices based on current position and zoom.
   * Call this after any camera transform changes.
   */
  private updateMatrices(): void {
    const { position, zoom, viewMatrix, inverseViewMatrix } = this.camera;

    // Reset to identity
    mat3.identity(viewMatrix);

    // Apply transformations in correct order:
    // 1. Translate to viewport center
    mat3.translate(viewMatrix, viewMatrix, [
      this.viewport.width / 2,
      this.viewport.height / 2,
    ]);

    // 2. Apply zoom
    mat3.scale(viewMatrix, viewMatrix, [zoom, zoom]);

    // 3. Translate by camera position (negated for view transform)
    mat3.translate(viewMatrix, viewMatrix, [-position[0], -position[1]]);

    // Compute inverse for screen-to-world transforms
    mat3.invert(inverseViewMatrix, viewMatrix);
  }

  /**
   * Pan the camera by the given delta in screen space.
   */
  pan(deltaX: number, deltaY: number): void {
    // Convert screen-space delta to world-space delta
    const worldDelta = vec2.fromValues(
      deltaX / this.camera.zoom,
      deltaY / this.camera.zoom
    );

    vec2.add(this.camera.position, this.camera.position, worldDelta);
    this.updateMatrices();
  }

  /**
   * Zoom the camera centered on a specific screen point.
   * @param delta - Zoom delta (positive = zoom in, negative = zoom out)
   * @param centerX - Screen X coordinate to zoom towards
   * @param centerY - Screen Y coordinate to zoom towards
   */
  zoom(delta: number, centerX: number, centerY: number): void {
    const oldZoom = this.camera.zoom;
    
    // Apply zoom with exponential scaling for smooth feel
    const zoomFactor = Math.pow(1.001, delta);
    let newZoom = oldZoom * zoomFactor;

    // Clamp zoom to reasonable bounds
    newZoom = Math.max(0.01, Math.min(100, newZoom));

    if (newZoom === oldZoom) return;

    // Get world position before zoom
    const worldPosBeforeZoom = this.screenToWorld(centerX, centerY);

    // Update zoom
    this.camera.zoom = newZoom;
    this.updateMatrices();

    // Get world position after zoom
    const worldPosAfterZoom = this.screenToWorld(centerX, centerY);

    // Adjust camera position to keep the same world point under cursor
    const deltaWorld = vec2.create();
    vec2.subtract(deltaWorld, worldPosBeforeZoom, worldPosAfterZoom);
    vec2.add(this.camera.position, this.camera.position, deltaWorld);

    this.updateMatrices();
  }

  /**
   * Set zoom to a specific level centered on viewport center.
   */
  setZoom(zoom: number, centerX?: number, centerY?: number): void {
    const cx = centerX ?? this.viewport.width / 2;
    const cy = centerY ?? this.viewport.height / 2;

    const worldPos = this.screenToWorld(cx, cy);
    this.camera.zoom = Math.max(0.01, Math.min(100, zoom));
    this.updateMatrices();

    const newWorldPos = this.screenToWorld(cx, cy);
    const deltaWorld = vec2.create();
    vec2.subtract(deltaWorld, worldPos, newWorldPos);
    vec2.add(this.camera.position, this.camera.position, deltaWorld);

    this.updateMatrices();
  }

  /**
   * Convert screen coordinates to world coordinates.
   */
  screenToWorld(screenX: number, screenY: number): vec2 {
    const screenPoint = vec2.fromValues(screenX, screenY);
    const worldPoint = vec2.create();
    vec2.transformMat3(worldPoint, screenPoint, this.camera.inverseViewMatrix);
    return worldPoint;
  }

  /**
   * Convert world coordinates to screen coordinates.
   */
  worldToScreen(worldX: number, worldY: number): vec2 {
    const worldPoint = vec2.fromValues(worldX, worldY);
    const screenPoint = vec2.create();
    vec2.transformMat3(screenPoint, worldPoint, this.camera.viewMatrix);
    return screenPoint;
  }

  /**
   * Check if a bounds intersects with the viewport.
   * Used for viewport culling.
   */
  isInViewport(worldBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): boolean {
    // Transform bounds corners to screen space
    const tl = this.worldToScreen(worldBounds.x, worldBounds.y);
    const br = this.worldToScreen(
      worldBounds.x + worldBounds.width,
      worldBounds.y + worldBounds.height
    );

    // Check if any part is visible in viewport
    return !(
      br[0] < 0 ||
      tl[0] > this.viewport.width ||
      br[1] < 0 ||
      tl[1] > this.viewport.height
    );
  }

  /**
   * Get the current camera state.
   */
  getCamera(): Camera {
    return this.camera;
  }

  /**
   * Update viewport dimensions.
   */
  updateViewport(width: number, height: number, pixelRatio: number = 1): void {
    this.viewport = { width, height, pixelRatio };
    this.updateMatrices();
  }

  /**
   * Get the visible world bounds in current viewport.
   */
  getVisibleWorldBounds(): { x: number; y: number; width: number; height: number } {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(
      this.viewport.width,
      this.viewport.height
    );

    return {
      x: topLeft[0],
      y: topLeft[1],
      width: bottomRight[0] - topLeft[0],
      height: bottomRight[1] - topLeft[1],
    };
  }

  /**
   * Reset camera to default state.
   */
  reset(): void {
    vec2.set(this.camera.position, 0, 0);
    this.camera.zoom = 1.0;
    this.updateMatrices();
  }
}
