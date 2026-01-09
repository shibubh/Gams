/**
 * Canvas Editor - Main integration component
 */

import React, { useEffect, useRef, useState } from "react";
import { createEngineStore, useStore } from "../engine/store/engine-store";
import { WebGL2Renderer } from "../engine/renderer/webgl-renderer";
import { ToolRouter } from "../engine/interaction/tool-router";
import { IndexedDBAdapter } from "../engine/storage/indexeddb-adapter";
import { AutosaveManager } from "../engine/storage/autosave-manager";
import type { CameraState, EngineStore, Renderer, ToolId } from "../engine/core/types";
import { vec2 } from "../engine/core/math";

// Global instances (singleton pattern for store)
let engineStore: EngineStore | null = null;

function getEngineStore(): EngineStore {
  if (!engineStore) {
    engineStore = createEngineStore();
  }
  return engineStore;
}

export function CanvasEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const toolRouterRef = useRef<ToolRouter | null>(null);
  const autosaveRef = useRef<AutosaveManager | null>(null);
  const cameraRef = useRef<CameraState>({
    zoom: 1,
    pan: vec2(0, 0),
    viewportPx: { w: 800, h: 600 },
    dpr: window.devicePixelRatio || 1,
  });

  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [isInitialized, setIsInitialized] = useState(false);

  const document = useStore((state) => state.document);
  const canUndo = useStore((state) => state.history.past.length > 0);
  const canRedo = useStore((state) => state.history.future.length > 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isInitialized) return;

    const store = getEngineStore();

    // Initialize renderer
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      depth: false,
    });
    const ctx2d = gl ? null : canvas.getContext("2d");

    const renderer = new WebGL2Renderer();
    renderer.setSurface({ canvas, gl, ctx2d });
    renderer.setCamera(cameraRef.current);
    rendererRef.current = renderer;

    // Initialize tool router
    const toolRouter = new ToolRouter(store, cameraRef.current, (reason) => {
      renderer.requestFrame(reason);
    });
    toolRouterRef.current = toolRouter;

    // Initialize storage
    const adapter = new IndexedDBAdapter();
    const autosave = new AutosaveManager(store, adapter);
    autosaveRef.current = autosave;

    // Load document
    adapter.load().then((doc) => {
      store.dispatch({ type: "SET_DOCUMENT", document: doc });
      renderer.setDocument(doc);
      autosave.start();
      renderer.requestFrame("initial load");
    });

    // Handle resize
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      cameraRef.current.viewportPx = { w: rect.width, h: rect.height };
      renderer.setCamera(cameraRef.current);
      toolRouter.updateCamera(cameraRef.current);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Subscribe to document changes
    const unsubscribe = store.subscribe(
      (doc) => doc,
      (doc) => {
        renderer.setDocument(doc);
        renderer.requestFrame("document changed");
      }
    );

    setIsInitialized(true);

    return () => {
      window.removeEventListener("resize", handleResize);
      unsubscribe();
      renderer.destroy();
      autosave.stop();
    };
  }, [isInitialized]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    toolRouterRef.current?.handlePointerDown(e.nativeEvent);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    toolRouterRef.current?.handlePointerMove(e.nativeEvent);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    toolRouterRef.current?.handlePointerUp(e.nativeEvent);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    toolRouterRef.current?.handleWheel(e.nativeEvent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const store = getEngineStore();

    if ((e.metaKey || e.ctrlKey) && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        store.dispatch({ type: "REDO" });
      } else {
        store.dispatch({ type: "UNDO" });
      }
    } else if (e.key === "Delete" || e.key === "Backspace") {
      // TODO: Implement delete
    } else {
      toolRouterRef.current?.handleKeyDown(e.nativeEvent);
    }
  };

  const handleToolChange = (toolId: ToolId) => {
    setActiveTool(toolId);
    toolRouterRef.current?.setActiveTool(toolId);
  };

  const handleUndo = () => {
    getEngineStore().dispatch({ type: "UNDO" });
  };

  const handleRedo = () => {
    getEngineStore().dispatch({ type: "REDO" });
  };

  const handleExport = async () => {
    const adapter = new IndexedDBAdapter();
    const blob = await adapter.export(document);
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = "design.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="canvas-editor" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "12px",
          backgroundColor: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <button
          onClick={() => handleToolChange("select")}
          style={{
            padding: "8px 16px",
            backgroundColor: activeTool === "select" ? "#3b82f6" : "white",
            color: activeTool === "select" ? "white" : "black",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Select
        </button>
        <button
          onClick={() => handleToolChange("pan")}
          style={{
            padding: "8px 16px",
            backgroundColor: activeTool === "pan" ? "#3b82f6" : "white",
            color: activeTool === "pan" ? "white" : "black",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Pan
        </button>
        <button
          onClick={() => handleToolChange("rect")}
          style={{
            padding: "8px 16px",
            backgroundColor: activeTool === "rect" ? "#3b82f6" : "white",
            color: activeTool === "rect" ? "white" : "black",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Rectangle
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleUndo}
          disabled={!canUndo}
          style={{
            padding: "8px 16px",
            backgroundColor: "white",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            cursor: canUndo ? "pointer" : "not-allowed",
            opacity: canUndo ? 1 : 0.5,
          }}
        >
          Undo
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          style={{
            padding: "8px 16px",
            backgroundColor: "white",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            cursor: canRedo ? "pointer" : "not-allowed",
            opacity: canRedo ? 1 : 0.5,
          }}
        >
          Redo
        </button>
        <button
          onClick={handleExport}
          style={{
            padding: "8px 16px",
            backgroundColor: "white",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Export
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: activeTool === "pan" ? "grab" : "crosshair",
          }}
        />
      </div>

      {/* Info panel */}
      <div
        style={{
          padding: "8px 12px",
          backgroundColor: "#f8fafc",
          borderTop: "1px solid #e2e8f0",
          fontSize: "12px",
          color: "#64748b",
        }}
      >
        Objects: {Object.keys(document.nodes).length - 1} | Selected:{" "}
        {document.selection.length} | Zoom: {Math.round(cameraRef.current.zoom * 100)}%
      </div>
    </div>
  );
}
