/**
 * Pointer abstraction layer.
 * Normalizes mouse, pen, and touch events into a unified interface.
 * 
 * Touch Support:
 * - Single touch: Works like mouse (select, drag, draw)
 * - Two-finger pinch: Zoom in/out centered on gesture
 * - Two-finger pan: Move the camera/viewport
 * - Multi-touch gestures are handled separately from single-touch interactions
 */

import type { PointerState } from '../../types/core';
import { CameraController } from '../../engine/camera';

export type PointerEventHandler = (state: PointerState) => void;

export class PointerManager {
  private canvas: HTMLCanvasElement;
  private camera: CameraController;
  private currentState: PointerState;

  private onPointerDownHandlers: PointerEventHandler[] = [];
  private onPointerMoveHandlers: PointerEventHandler[] = [];
  private onPointerUpHandlers: PointerEventHandler[] = [];
  private onWheelHandlers: ((deltaY: number, x: number, y: number) => void)[] = [];

  // Multi-touch gesture tracking
  private activePointers: Map<number, PointerEvent> = new Map();
  private lastPinchDistance: number | null = null;
  private lastPinchCenter: { x: number; y: number } | null = null;

  constructor(canvas: HTMLCanvasElement, camera: CameraController) {
    this.canvas = canvas;
    this.camera = camera;

    this.currentState = {
      position: { x: 0, y: 0 },
      worldPosition: { x: 0, y: 0 },
      buttons: 0,
      button: 0,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      pointerType: 'mouse',
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Pointer events (unified mouse/pen/touch)
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);

    // Wheel events for zoom
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handlePointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);

    // Track pointer for multi-touch gestures
    this.activePointers.set(e.pointerId, e);

    const state = this.createPointerState(e);
    this.currentState = state;

    // Only fire handlers for single touch or primary pointer
    if (this.activePointers.size === 1 || e.isPrimary) {
      this.onPointerDownHandlers.forEach((handler) => handler(state));
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    // Update active pointer
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, e);
    }

    const state = this.createPointerState(e);
    this.currentState = state;

    // Handle multi-touch gestures
    if (this.activePointers.size === 2) {
      this.handleTwoFingerGesture();
      return; // Don't fire normal move handlers during multi-touch
    }

    this.onPointerMoveHandlers.forEach((handler) => handler(state));
  };

  private handlePointerUp = (e: PointerEvent): void => {
    e.preventDefault();
    this.canvas.releasePointerCapture(e.pointerId);

    // Remove pointer from tracking
    this.activePointers.delete(e.pointerId);

    // Reset gesture state when all pointers are released
    if (this.activePointers.size === 0) {
      this.lastPinchDistance = null;
      this.lastPinchCenter = null;
    }

    const state = this.createPointerState(e);
    this.currentState = state;

    // Only fire handlers for single touch or primary pointer
    if (this.activePointers.size === 0 || e.isPrimary) {
      this.onPointerUpHandlers.forEach((handler) => handler(state));
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.onWheelHandlers.forEach((handler) => handler(e.deltaY, x, y));
  };

  /**
   * Handle two-finger gestures (pinch-to-zoom and two-finger pan).
   */
  private handleTwoFingerGesture(): void {
    const pointers = Array.from(this.activePointers.values());
    if (pointers.length !== 2) return;

    const [p1, p2] = pointers;
    const rect = this.canvas.getBoundingClientRect();

    // Calculate positions relative to canvas
    const x1 = p1.clientX - rect.left;
    const y1 = p1.clientY - rect.top;
    const x2 = p2.clientX - rect.left;
    const y2 = p2.clientY - rect.top;

    // Calculate center point between two fingers
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    // Calculate distance between two fingers
    const distance = Math.sqrt(
      Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
    );

    // Handle pinch-to-zoom
    if (this.lastPinchDistance !== null) {
      const deltaDistance = distance - this.lastPinchDistance;
      const zoomDelta = deltaDistance * 2; // Scale factor for sensitivity

      // Zoom centered on the midpoint between fingers
      this.onWheelHandlers.forEach((handler) => 
        handler(-zoomDelta, centerX, centerY)
      );
    }

    // Handle two-finger pan
    if (this.lastPinchCenter !== null) {
      const deltaX = centerX - this.lastPinchCenter.x;
      const deltaY = centerY - this.lastPinchCenter.y;

      // Pan the camera
      this.camera.pan(-deltaX, -deltaY);
    }

    // Update state for next frame
    this.lastPinchDistance = distance;
    this.lastPinchCenter = { x: centerX, y: centerY };
  }

  private createPointerState(e: PointerEvent): PointerState {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const worldPos = this.camera.screenToWorld(x, y);

    return {
      position: { x, y },
      worldPosition: { x: worldPos[0], y: worldPos[1] },
      buttons: e.buttons,
      button: e.button,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      pressure: e.pressure,
      pointerType: e.pointerType as 'mouse' | 'pen' | 'touch',
    };
  }

  /**
   * Register pointer down handler.
   */
  onPointerDown(handler: PointerEventHandler): () => void {
    this.onPointerDownHandlers.push(handler);
    return () => {
      const index = this.onPointerDownHandlers.indexOf(handler);
      if (index > -1) this.onPointerDownHandlers.splice(index, 1);
    };
  }

  /**
   * Register pointer move handler.
   */
  onPointerMove(handler: PointerEventHandler): () => void {
    this.onPointerMoveHandlers.push(handler);
    return () => {
      const index = this.onPointerMoveHandlers.indexOf(handler);
      if (index > -1) this.onPointerMoveHandlers.splice(index, 1);
    };
  }

  /**
   * Register pointer up handler.
   */
  onPointerUp(handler: PointerEventHandler): () => void {
    this.onPointerUpHandlers.push(handler);
    return () => {
      const index = this.onPointerUpHandlers.indexOf(handler);
      if (index > -1) this.onPointerUpHandlers.splice(index, 1);
    };
  }

  /**
   * Register wheel handler.
   */
  onWheel(handler: (deltaY: number, x: number, y: number) => void): () => void {
    this.onWheelHandlers.push(handler);
    return () => {
      const index = this.onWheelHandlers.indexOf(handler);
      if (index > -1) this.onWheelHandlers.splice(index, 1);
    };
  }

  /**
   * Get current pointer state.
   */
  getCurrentState(): PointerState {
    return this.currentState;
  }

  /**
   * Cleanup event listeners.
   */
  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);

    this.onPointerDownHandlers = [];
    this.onPointerMoveHandlers = [];
    this.onPointerUpHandlers = [];
    this.onWheelHandlers = [];
    
    // Clear multi-touch state
    this.activePointers.clear();
    this.lastPinchDistance = null;
    this.lastPinchCenter = null;
  }
}
