/**
 * Main Canvas component - the infinite canvas rendering surface.
 * Decoupled from React rendering loop for 60 FPS performance.
 */

import React, { useEffect, useRef } from 'react';
import { RenderEngine } from '../../renderer/RenderEngine';
import { PointerManager } from '../../interactions/pointer/PointerManager';
import { SelectTool } from '../../tools/SelectTool';
import { PanTool } from '../../tools/PanTool';
import { RectangleTool } from '../../tools/RectangleTool';
import type { Tool, ToolContext } from '../../tools/Tool';
import { useAppStore, type AppState } from '../../state/store';
import type { SceneNode, PointerState } from '../../types/core';
import { ToolType } from '../../types/core';

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RenderEngine | null>(null);
  const pointerRef = useRef<PointerManager | null>(null);
  const toolsRef = useRef<Map<ToolType, Tool>>(new Map());
  const currentToolRef = useRef<Tool | null>(null);

  const scene = useAppStore((state: AppState) => state.scene);
  const selectedNodes = useAppStore((state: AppState) => state.selectedNodes);
  const hoveredNode = useAppStore((state: AppState) => state.hoveredNode);
  const currentTool = useAppStore((state: AppState) => state.currentTool);

  // Initialize engine and tools
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create render engine
    const engine = new RenderEngine(canvas, {
      preferWebGL: true,
      antialias: true,
    });
    engineRef.current = engine;

    // Create pointer manager
    const pointer = new PointerManager(canvas, engine.getCamera());
    pointerRef.current = pointer;

    // Create tool context
    const toolContext: ToolContext = {
      getScene: () => useAppStore.getState().scene,
      updateScene: (scene: SceneNode) => useAppStore.getState().updateScene(scene),
      setSelection: (nodeIds: string[]) => useAppStore.getState().setSelection(nodeIds),
      getSelection: () => useAppStore.getState().selectedNodes,
      markDirty: () => engine.markDirty(),
    };

    // Initialize tools
    const tools = new Map<ToolType, Tool>();
    tools.set('SELECT', new SelectTool(toolContext));
    tools.set('PAN', new PanTool(engine.getCamera(), toolContext));
    tools.set('RECTANGLE', new RectangleTool(toolContext));
    toolsRef.current = tools;

    // Set initial tool
    const initialTool = tools.get(currentTool);
    if (initialTool) {
      currentToolRef.current = initialTool;
      initialTool.onActivate?.();
    }

    // Setup pointer event routing to current tool
    pointer.onPointerDown((state: PointerState) => {
      currentToolRef.current?.onPointerDown(state);
    });

    pointer.onPointerMove((state: PointerState) => {
      currentToolRef.current?.onPointerMove(state);
    });

    pointer.onPointerUp((state: PointerState) => {
      currentToolRef.current?.onPointerUp(state);
    });

    // Setup zoom on wheel
    pointer.onWheel((deltaY: number, x: number, y: number) => {
      engine.getCamera().zoom(-deltaY, x, y);
      engine.markDirty();
    });

    // Start render loop
    engine.start();

    // Cleanup
    return () => {
      engine.stop();
      engine.dispose();
      pointer.dispose();
    };
  }, []);

  // Update scene when it changes
  useEffect(() => {
    if (scene && engineRef.current) {
      engineRef.current.setScene(scene);
    }
  }, [scene]);

  // Update selection when it changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSelection(Array.from(selectedNodes));
    }
  }, [selectedNodes]);

  // Update hovered node when it changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setHovered(hoveredNode);
    }
  }, [hoveredNode]);

  // Switch tools when current tool changes
  useEffect(() => {
    const tools = toolsRef.current;
    const newTool = tools.get(currentTool);

    if (newTool && newTool !== currentToolRef.current) {
      // Deactivate old tool
      currentToolRef.current?.onDeactivate?.();

      // Activate new tool
      currentToolRef.current = newTool;
      newTool.onActivate?.();
    }
  }, [currentTool]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
        cursor: currentToolRef.current?.cursor || 'default',
      }}
    />
  );
};
