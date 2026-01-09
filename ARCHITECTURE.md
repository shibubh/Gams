# Architecture Documentation

## High-Level Architecture

The design canvas system is built on a clean separation between engine, renderer, interaction, and UI layers.

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer (React)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Toolbar    │  │   Panels    │  │  Canvas     │         │
│  │ Component   │  │ Components  │  │ Component   │         │
│  └─────────────┘  └─────────────┘  └──────┬──────┘         │
└────────────────────────────────────────────┼────────────────┘
                                             │
┌────────────────────────────────────────────┼────────────────┐
│                    State Layer (Zustand)   │                │
│  ┌──────────────────────────────────────┐  │                │
│  │  AppStore (scene, selection, tools)  │◄─┘                │
│  └──────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                  Engine Layer             │                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───▼──────────┐     │
│  │    Camera    │  │ Scene Graph  │  │    Tools     │     │
│  │  Controller  │  │  (AST/Tree)  │  │   System     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│               Renderer Layer              │                 │
│  ┌──────────────────────▼───────────────────────────┐      │
│  │          Render Engine (Orchestrator)            │      │
│  └──────────────────────┬───────────────────────────┘      │
│         ┌───────────────┴───────────────┐                  │
│  ┌──────▼───────┐              ┌────────▼─────────┐        │
│  │    WebGL2    │              │    Canvas2D      │        │
│  │   Renderer   │              │    Renderer      │        │
│  └──────────────┘              └──────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│             Interaction Layer             │                 │
│  ┌──────────────────────▼───────────────────────────┐      │
│  │        Pointer Manager (Event Abstraction)       │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Render Pipeline

```
Scene Update → Store → Canvas Component → Render Engine → WebGL/Canvas2D → Screen
     ↑                                          ↓
     └──────── Culling ← Camera Transform ←────┘
```

1. **Scene changes** trigger store updates
2. **Canvas component** observes store and updates render engine
3. **Render engine** applies camera transform and performs viewport culling
4. **Renderer** (WebGL or Canvas2D) draws visible nodes in layers
5. **Screen** displays the result at 60 FPS

### Interaction Flow

```
User Input → Pointer Manager → Current Tool → Scene Update → Store → Render
```

1. **User interaction** (mouse, pen, touch)
2. **Pointer Manager** normalizes events
3. **Current Tool** handles event and updates scene
4. **Store** receives immutable scene update
5. **Render** reflects changes

## Core Subsystems

### 1. Camera System

**File:** `src/engine/camera.ts`

The camera manages the viewport transformation from world coordinates to screen coordinates.

**Key concepts:**
- **View Matrix**: Transforms world → screen coordinates
- **Inverse View Matrix**: Transforms screen → world coordinates
- **Zoom**: Exponential scaling for smooth feel
- **Pan**: Translation in world space

**Math:**
```
ViewMatrix = Translate(viewport_center) × Scale(zoom) × Translate(-camera_pos)
```

**API:**
```typescript
camera.pan(deltaX, deltaY)           // Pan by screen-space delta
camera.zoom(delta, centerX, centerY) // Zoom toward point
camera.screenToWorld(x, y)           // Convert coordinates
camera.worldToScreen(x, y)           // Convert coordinates
camera.isInViewport(bounds)          // Culling check
```

### 2. Scene Graph

**File:** `src/engine/scene/sceneGraph.ts`

An immutable Abstract Syntax Tree representing the document.

**Node Types:**
- Frame (container with clipping)
- Rectangle
- Ellipse
- Line
- Text
- Group (logical grouping)

**Immutability:**
All scene operations return new nodes/trees. Never mutate in place.

```typescript
// ❌ Wrong
node.bounds.x = 100;

// ✅ Correct
const updated = updateNode(root, nodeId, { 
  bounds: { ...node.bounds, x: 100 } 
});
```

**Operations:**
```typescript
updateNode(root, id, updates)  // Update single node
addChild(root, parentId, child) // Add child to parent
removeNode(root, id)            // Remove node
findNode(root, id)              // Find by ID
collectAllNodes(root)           // Flatten tree
getNodesAtPoint(root, point)    // Spatial query
```

### 3. Rendering Engine

**File:** `src/renderer/RenderEngine.ts`

Orchestrates the rendering pipeline with WebGL or Canvas2D.

**Responsibilities:**
- Manage renderer lifecycle
- Apply viewport culling
- Layer-based rendering
- Handle resize events
- Manage render loop

**Rendering Layers (in order):**
1. Background (grid)
2. Shapes (scene nodes)
3. Selection (outlines, handles)
4. Guides (snapping lines)
5. Overlays (UI elements)

**Performance:**
- Decoupled from React (no re-renders)
- Runs at 60 FPS via `requestAnimationFrame`
- Only renders when `isDirty` flag is set
- Viewport culling reduces draw calls

### 4. WebGL Renderer

**File:** `src/renderer/webgl/WebGLRenderer.ts`

High-performance GPU-accelerated rendering.

**Features:**
- Batched draw calls
- Shader-based rendering
- Vertex Array Objects (VAO) for geometry
- Matrix-based transforms

**Shader Pipeline:**
```glsl
Vertex Shader:
  position_clip = viewMatrix × modelMatrix × vertex

Fragment Shader:
  output = color
```

**Optimization:**
- Reuse VAOs for common shapes
- Batch similar objects
- Minimize state changes

### 5. Canvas2D Renderer (Fallback)

**File:** `src/renderer/canvas2d/Canvas2DRenderer.ts`

Software rendering fallback for compatibility.

**When used:**
- WebGL2 not supported
- User preference
- Testing/debugging

**Trade-offs:**
- Slower than WebGL
- Limited to ~10k objects
- CPU-bound rendering

### 6. Tool System

**Files:** `src/tools/*.ts`

Plugin-based interaction system.

**Tool Interface:**
```typescript
interface Tool {
  type: ToolType;
  cursor: string;
  onPointerDown(state: PointerState): void;
  onPointerMove(state: PointerState): void;
  onPointerUp(state: PointerState): void;
  onActivate?(): void;
  onDeactivate?(): void;
}
```

**Available Tools:**
- **SelectTool**: Selection, drag, resize, rotate
- **PanTool**: Camera panning
- **RectangleTool**: Draw rectangles
- **EllipseTool**: Draw ellipses (TODO)
- **LineTool**: Draw lines (TODO)
- **TextTool**: Create text (TODO)

**Tool Context:**
Tools receive a context to interact with the scene:
```typescript
interface ToolContext {
  getScene(): SceneNode | null;
  updateScene(scene: SceneNode): void;
  setSelection(nodeIds: string[]): void;
  getSelection(): Set<string>;
  markDirty(): void;
}
```

### 7. Pointer Manager

**File:** `src/interactions/pointer/PointerManager.ts`

Unified abstraction over mouse, pen, and touch events.

**Features:**
- Normalizes pointer events
- Converts screen → world coordinates
- Handles pointer capture
- Supports wheel events for zoom
- **Multi-touch gesture support:**
  - Two-finger pinch-to-zoom
  - Two-finger pan
  - Gesture detection and handling

**Touch Gesture Implementation:**

The PointerManager tracks multiple active pointers and detects multi-touch gestures:

```typescript
// Track active pointers for multi-touch
private activePointers: Map<number, PointerEvent> = new Map();
private lastPinchDistance: number | null = null;
private lastPinchCenter: { x: number; y: number } | null = null;

// Two-finger gesture detection
if (activePointers.size === 2) {
  // Calculate distance between fingers for pinch-to-zoom
  // Calculate center point for pan gesture
  // Apply zoom and pan transformations
}
```

**Gesture Behavior:**
- **Single touch**: Treated as primary pointer (mouse-like behavior)
- **Two-finger pinch**: Zoom centered on midpoint between fingers
- **Two-finger pan**: Move camera by gesture delta
- **Touch isolation**: Multi-touch gestures don't trigger single-touch handlers

**Pointer State:**
```typescript
interface PointerState {
  position: Point;           // Screen coordinates
  worldPosition: Point;      // World coordinates
  buttons: number;
  button: number;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  pressure?: number;
  pointerType: 'mouse' | 'pen' | 'touch';
}
```

### 8. State Management

**File:** `src/state/store.ts`

Zustand store for global application state.

**State:**
- Document and scene
- Selection (selected nodes, hovered node)
- Current tool
- History (undo/redo state)

**Principles:**
- Single source of truth
- Immutable updates
- Minimal store, computed values in components
- Actions for state updates

## Transform Math

All geometric transforms use 3x3 matrices for 2D affine transformations.

**Matrix format:**
```
[ sx  shy tx ]
[ shx sy  ty ]
[ 0   0   1  ]
```

Where:
- `sx, sy`: Scale
- `shx, shy`: Shear
- `tx, ty`: Translation

**Transform composition:**
```typescript
const transform = translate × rotate × scale
```

**Nested transforms:**
Child world matrix = parent world matrix × child local matrix

## Performance Optimizations

### 1. Viewport Culling

Only render objects visible in the viewport.

```typescript
// Pseudo-code
visibleNodes = allNodes.filter(node => 
  camera.isInViewport(node.bounds)
);
```

**Impact:** Constant rendering cost regardless of total object count.

### 2. Dirty Rendering

Only redraw when something changes.

```typescript
if (isDirty) {
  render();
  isDirty = false;
}
```

**Triggers:**
- Scene updates
- Camera changes
- Selection changes
- Tool interactions

### 3. Batched Draw Calls

Group similar objects to minimize GPU state changes.

```typescript
// Group by material/shader
const batches = groupByShader(visibleNodes);
batches.forEach(batch => {
  setupShader(batch.shader);
  batch.nodes.forEach(draw);
});
```

### 4. Decoupled Render Loop

React doesn't control rendering - the engine does.

```typescript
// ❌ Don't do this
useEffect(() => {
  render(); // Re-renders on every React update
}, [scene, camera, selection]);

// ✅ Do this
useEffect(() => {
  engine.setScene(scene);
  engine.markDirty(); // Just mark dirty
}, [scene]);
```

## Extensibility Points

### Adding a New Tool

1. Create tool class implementing `Tool` interface
2. Register in `Canvas.tsx` tools map
3. Add to toolbar
4. Implement keyboard shortcut

### Adding a New Node Type

1. Add type to `NodeType` enum
2. Create node interface extending `BaseNode`
3. Add factory function in `sceneGraph.ts`
4. Implement rendering in both renderers
5. Add selection/manipulation logic

### Adding a Renderer

1. Implement renderer interface
2. Add to `RenderEngine` initialization
3. Implement all render methods
4. Add fallback logic

## Future Enhancements

### History System

Command pattern with undo/redo:

```typescript
interface Command {
  execute(): void;
  undo(): void;
  canMerge?(other: Command): boolean;
}
```

### Snapping System

Spatial indexing for fast queries:

```typescript
interface SnapResult {
  snapped: boolean;
  guides: SnapGuide[];
  position: Point;
}
```

### Text Editing

SDF (Signed Distance Field) text rendering for quality at any zoom level.

### Advanced Selection

- Marquee selection
- Deep select (nested nodes)
- Lasso selection

### File Format

```typescript
interface DocumentV1 {
  version: "1.0.0";
  metadata: {...};
  root: SceneNode;
  camera: Camera;
}
```

## Testing Strategy

- **Unit tests**: Pure functions (transforms, bounds, etc.)
- **Integration tests**: Tools, scene operations
- **Visual tests**: Rendering correctness
- **Performance tests**: Large scene stress tests

## Debugging

Use browser DevTools:
- Performance profiler for FPS
- Memory profiler for leaks
- Canvas inspection for rendering

Add debug overlays:
- Bounds visualization
- Transform gizmos
- Performance stats
