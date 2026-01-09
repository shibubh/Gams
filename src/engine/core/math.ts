/**
 * Math utilities for transforms and camera operations
 */

import { mat3 } from "gl-matrix";
import type { Vec2, Mat3, Rect, CameraState } from "./types";

/**
 * Create a new Vec2
 */
export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

/**
 * Create a new Rect
 */
export function rect(x = 0, y = 0, w = 0, h = 0): Rect {
  return { x, y, w, h };
}

/**
 * Create identity matrix
 */
export function mat3Identity(): Mat3 {
  return mat3.create() as Mat3;
}

/**
 * Create translation matrix
 */
export function mat3Translate(x: number, y: number): Mat3 {
  const m = mat3.create();
  mat3.fromTranslation(m, [x, y]);
  return m as Mat3;
}

/**
 * Create scale matrix
 */
export function mat3Scale(sx: number, sy = sx): Mat3 {
  const m = mat3.create();
  mat3.fromScaling(m, [sx, sy]);
  return m as Mat3;
}

/**
 * Create rotation matrix
 */
export function mat3Rotate(radians: number): Mat3 {
  const m = mat3.create();
  mat3.fromRotation(m, radians);
  return m as Mat3;
}

/**
 * Multiply matrices
 */
export function mat3Multiply(a: Mat3, b: Mat3): Mat3 {
  const result = mat3.create();
  mat3.multiply(result, a, b);
  return result as Mat3;
}

/**
 * Invert matrix
 */
export function mat3Invert(m: Mat3): Mat3 | null {
  const result = mat3.create();
  const success = mat3.invert(result, m);
  return success ? (result as Mat3) : null;
}

/**
 * Transform a point by a matrix
 */
export function mat3TransformPoint(m: Mat3, p: Vec2): Vec2 {
  const result = [0, 0];
  const vec = [p.x, p.y];
  mat3.multiply(result as any, m as any, vec as any);
  return vec2(
    m[0] * p.x + m[3] * p.y + m[6],
    m[1] * p.x + m[4] * p.y + m[7]
  );
}

/**
 * Extract translation from matrix
 */
export function mat3GetTranslation(m: Mat3): Vec2 {
  return vec2(m[6], m[7]);
}

/**
 * Extract scale from matrix (approximate)
 */
export function mat3GetScale(m: Mat3): Vec2 {
  const sx = Math.sqrt(m[0] * m[0] + m[1] * m[1]);
  const sy = Math.sqrt(m[3] * m[3] + m[4] * m[4]);
  return vec2(sx, sy);
}

/**
 * Create view-projection matrix from camera state
 */
export function getCameraMatrix(camera: CameraState): Mat3 {
  const { zoom, pan, viewportPx } = camera;
  
  // Create transform that converts world coords to screen coords
  // 1. Translate by -pan (move world origin)
  // 2. Scale by zoom
  // 3. Translate to center of viewport
  
  const m = mat3.create();
  
  // Center viewport
  mat3.translate(m, m, [viewportPx.w / 2, viewportPx.h / 2]);
  
  // Apply zoom
  mat3.scale(m, m, [zoom, zoom]);
  
  // Apply pan
  mat3.translate(m, m, [-pan.x, -pan.y]);
  
  return m as Mat3;
}

/**
 * Get inverse camera matrix (screen to world)
 */
export function getCameraMatrixInverse(camera: CameraState): Mat3 | null {
  const m = getCameraMatrix(camera);
  return mat3Invert(m);
}

/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(screenPt: Vec2, camera: CameraState): Vec2 {
  const invMatrix = getCameraMatrixInverse(camera);
  if (!invMatrix) return vec2(0, 0);
  return mat3TransformPoint(invMatrix, screenPt);
}

/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(worldPt: Vec2, camera: CameraState): Vec2 {
  const matrix = getCameraMatrix(camera);
  return mat3TransformPoint(matrix, worldPt);
}

/**
 * Check if a rect intersects with another rect
 */
export function rectIntersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Check if a point is inside a rect
 */
export function rectContainsPoint(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/**
 * Expand a rect by a margin
 */
export function rectExpand(r: Rect, margin: number): Rect {
  return rect(r.x - margin, r.y - margin, r.w + margin * 2, r.h + margin * 2);
}

/**
 * Get bounds of a rect after transform
 */
export function transformRect(r: Rect, m: Mat3): Rect {
  // Transform all four corners
  const tl = mat3TransformPoint(m, vec2(r.x, r.y));
  const tr = mat3TransformPoint(m, vec2(r.x + r.w, r.y));
  const bl = mat3TransformPoint(m, vec2(r.x, r.y + r.h));
  const br = mat3TransformPoint(m, vec2(r.x + r.w, r.y + r.h));
  
  // Find bounding box
  const minX = Math.min(tl.x, tr.x, bl.x, br.x);
  const minY = Math.min(tl.y, tr.y, bl.y, br.y);
  const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
  const maxY = Math.max(tl.y, tr.y, bl.y, br.y);
  
  return rect(minX, minY, maxX - minX, maxY - minY);
}

/**
 * Compute world bounds from local bounds and world transform
 */
export function computeWorldBounds(localBounds: Rect, worldTransform: Mat3): Rect {
  return transformRect(localBounds, worldTransform);
}

/**
 * Distance between two points
 */
export function vec2Distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Add two vectors
 */
export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return vec2(a.x + b.x, a.y + b.y);
}

/**
 * Subtract two vectors
 */
export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return vec2(a.x - b.x, a.y - b.y);
}

/**
 * Scale a vector
 */
export function vec2Scale(v: Vec2, s: number): Vec2 {
  return vec2(v.x * s, v.y * s);
}

/**
 * Normalize a vector
 */
export function vec2Normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return vec2(0, 0);
  return vec2(v.x / len, v.y / len);
}
