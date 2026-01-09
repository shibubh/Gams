/**
 * Pointer abstraction layer.
 * Normalizes mouse, pen, and touch events into a unified interface.
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

    const state = this.createPointerState(e);
    this.currentState = state;

    this.onPointerDownHandlers.forEach((handler) => handler(state));
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const state = this.createPointerState(e);
    this.currentState = state;

    this.onPointerMoveHandlers.forEach((handler) => handler(state));
  };

  private handlePointerUp = (e: PointerEvent): void => {
    e.preventDefault();
    this.canvas.releasePointerCapture(e.pointerId);

    const state = this.createPointerState(e);
    this.currentState = state;

    this.onPointerUpHandlers.forEach((handler) => handler(state));
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.onWheelHandlers.forEach((handler) => handler(e.deltaY, x, y));
  };

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
  }
}
