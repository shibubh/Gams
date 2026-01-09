/**
 * Main Canvas component - the infinite canvas rendering surface.
 * Decoupled from React rendering loop for 60 FPS performance.
 */

import React, { useEffect, useRef, useState } from 'react';
import { RenderEngine } from '../../renderer/RenderEngine';
import { PointerManager } from '../../interactions/pointer/PointerManager';
import { SelectTool } from '../../tools/SelectTool';
import { PanTool } from '../../tools/PanTool';
import { RectangleTool } from '../../tools/RectangleTool';
import { FrameTool } from '../../tools/FrameTool';
import { EllipseTool } from '../../tools/EllipseTool';
import { PerformanceOverlay } from '../components/PerformanceOverlay';
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
  const [showPerf, setShowPerf] = useState(false);

  const scene = useAppStore((state: AppState) => state.scene);
  const selectedNodes = useAppStore((state: AppState) => state.selectedNodes);
  const hoveredNode = useAppStore((state: AppState) => state.hoveredNode);
  const currentTool = useAppStore((state: AppState) => state.currentTool);

  // Initialize engine and tools
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create render engine (use WebGL for high performance)
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
    tools.set('FRAME', new FrameTool(toolContext));
    tools.set('SELECT', new SelectTool(toolContext));
    tools.set('PAN', new PanTool(engine.getCamera(), toolContext));
    tools.set('RECTANGLE', new RectangleTool(toolContext));
    tools.set('ELLIPSE', new EllipseTool(toolContext));
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

    // Setup zoom on wheel with performance tracking
    pointer.onWheel((deltaY: number, x: number, y: number) => {
      const wheelStart = performance.now();
      
      engine.getCamera().zoom(-deltaY, x, y);
      
      // Update WASM camera transform
      const wasm = engine.getWasmAdapter();
      if (wasm.isInitialized()) {
        const cam = engine.getCamera().getCamera();
        const viewport = {
          width: canvas.clientWidth,
          height: canvas.clientHeight,
        };
        wasm.setCamera(
          cam.zoom,
          cam.position[0],
          cam.position[1],
          viewport.width,
          viewport.height,
          window.devicePixelRatio || 1
        );
      }
      
      engine.markDirty();
      
      const wheelTime = performance.now() - wheelStart;
      if (wheelTime > 2) {
        console.warn(`[Canvas] Wheel handler took ${wheelTime.toFixed(2)}ms (target: <2ms)`);
      }
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

  // Setup keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Tool shortcuts (case-insensitive)
      const key = event.key.toLowerCase();
      const setTool = useAppStore.getState().setTool;
      const tools = toolsRef.current;

      // Map keys to tool types
      const keyToTool: Record<string, ToolType> = {
        'f': 'FRAME',
        'v': 'SELECT',
        'h': 'PAN',
        'r': 'RECTANGLE',
        'o': 'ELLIPSE',
        'l': 'LINE',
        't': 'TEXT',
      };

      const toolType = keyToTool[key];
      
      if (toolType) {
        // Only switch if the tool is implemented
        if (tools.has(toolType)) {
          event.preventDefault();
          setTool(toolType);
        } else {
          // Tool not implemented yet, log for debugging
          console.warn(`Tool ${toolType} mapped to key '${key}' is not yet implemented`);
        }
      } else if (key === 'escape') {
        event.preventDefault();
        useAppStore.getState().clearSelection();
      } else if (key === 'p' && event.shiftKey) {
        // Shift+P: Toggle performance overlay
        event.preventDefault();
        setShowPerf(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
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
      <PerformanceOverlay visible={showPerf} />
    </>
  );
};
