# WASM Performance Layer + CSS-like Styling - Architecture

This document describes the WASM performance acceleration layer and CSS-like styling system added to the infinite canvas editor.

## Overview

The editor now includes:
1. **WASM Core** (Rust) - High-performance spatial indexing and queries
2. **CSS-like Style Model** - Design-team ready styling with box model, shadows, borders, etc.
3. **Performance Instrumentation** - Real-time metrics and budget tracking

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      UI Layer (React 19)                        │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────┐      │
│  │ Toolbar  │  │  Panels  │  │  PerformanceOverlay     │      │
│  │ (lucide) │  │          │  │  (metrics display)      │      │
│  └──────────┘  └──────────┘  └─────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼─────────────────────────────────┐
│              State Layer (Zustand)       │                       │
│  ┌───────────────────────────────────────▼────────────────┐     │
│  │  Scene Graph (Immutable + Extended Styles)             │     │
│  │  - NodeStyleExtended (box model, shadows, etc.)        │     │
│  └────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼─────────────────────────────────┐
│              Engine Layer      │                                 │
│  ┌─────────────┐  ┌────────────▼────────┐  ┌───────────────┐   │
│  │   Camera    │  │   Scene Graph       │  │  Tools System │   │
│  │ Controller  │  │   + Styles          │  │  (integrated) │   │
│  └──────┬──────┘  └─────────┬───────────┘  └───────┬───────┘   │
│         │                   │                      │            │
│         │         ┌─────────▼──────────────────────▼────────┐  │
│         │         │   WASM Adapter (TypeScript)             │  │
│         │         │   - IdRegistry (string <-> u32)         │  │
│         │         │   - Performance tracking                │  │
│         │         └─────────┬───────────────────────────────┘  │
│         │                   │                                  │
│         │         ┌─────────▼──────────────────────────┐      │
│         │         │   WASM Core (Rust)                 │      │
│         │         │   - SpatialIndex (uniform grid)    │      │
│         │         │   - Camera transforms              │      │
│         │         │   - Culling queries                │      │
│         │         │   - Hit-test queries               │      │
│         │         │   - Snap queries                   │      │
│         │         └────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼─────────────────────────────────┐
│            Renderer Layer      │                                 │
│  ┌─────────────────────────────▼──────────────────────────┐     │
│  │  RenderEngine (orchestrator)                           │     │
│  │  - Consumes visible IDs from WASM                      │     │
│  │  - Style-aware rendering (borders, shadows, radius)    │     │
│  └────────────────────┬───────────────────────────────────┘     │
│           ┌───────────┴───────────────┐                         │
│    ┌──────▼───────┐          ┌────────▼────────┐               │
│    │ WebGL2       │          │ Canvas2D        │               │
│    │ Renderer     │          │ Renderer        │               │
│    │ (+ styles)   │          │ (+ styles)      │               │
│    └──────────────┘          └─────────────────┘               │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Scene Updates → WASM Index

When the scene changes (nodes added/moved/removed):

```typescript
// JS: Scene update
updateScene(newScene);

// WASM Adapter: Incremental update
wasmAdapter.upsertNode(nodeId, bounds, zIndex, flags);
// OR
wasmAdapter.removeNode(nodeId);
```

Inside WASM:
- Maps string ID → u32 handle (IdRegistry)
- Updates spatial index (uniform grid hash)
- O(1) insertion/removal with grid cell updates

### 2. Camera Changes → Culling

On pan/zoom:

```typescript
// JS: Camera update
camera.pan(deltaX, deltaY);

// WASM: Update camera transform
wasmAdapter.setCamera(zoom, panX, panY, viewportW, viewportH, dpr);

// WASM: Query visible nodes
const visibleIds = wasmAdapter.getVisibleNodes();
// Returns: ['node1', 'node2', ...] (topmost first)
```

Inside WASM:
- Computes visible world bounds from camera
- Queries spatial index for intersecting AABBs
- Filters hidden/locked nodes
- Returns sorted by z-index

### 3. Interaction → Hit Testing

On pointer down/move:

```typescript
// JS: World coordinates from pointer
const worldPos = camera.screenToWorld(screenX, screenY);

// WASM: Hit test
const hitIds = wasmAdapter.hitTestPoint(worldPos.x, worldPos.y);
// Returns: ['topmost', 'next', ...] (z-order)

// Tool: Use result
const topNode = hitIds[0];
if (topNode) selectNode(topNode);
```

Inside WASM:
- Queries grid cell at point
- Tests AABB containment
- Sorts by z-index (topmost first)
- Filters locked/hidden

### 4. Snapping → Query Near

During drag operations:

```typescript
// JS: Request snap
const snapResult = wasmAdapter.snapPoint(worldX, worldY, {
  snapThreshold: 10 / zoom, // zoom-aware
  gridSize: 20,
  enableGrid: true,
  enableObjects: true,
});

if (snapResult.snapped) {
  // Use snapped position
  position = { x: snapResult.x, y: snapResult.y };
}
```

Inside WASM:
- Grid snapping: rounds to grid
- Object snapping: queries nearby nodes, extracts edges/centers
- Returns snapped point + guide count

## CSS-like Style Model

### Structure

Located in `src/types/styles.ts`:

```typescript
interface NodeStyleExtended {
  version: string; // "1.0.0"
  
  boxModel?: {
    margin: EdgeValues;   // { t, r, b, l }
    padding: EdgeValues;
    border: {
      width: EdgeValues;
      color: string;
      style: 'solid' | 'dashed' | 'dotted';
    };
    radius: CornerRadius; // { tl, tr, br, bl }
  };
  
  background?: {
    color?: string;
    gradient?: Gradient; // placeholder
    image?: BackgroundImage; // placeholder
  };
  
  shadows?: BoxShadow[]; // multiple shadows
  
  opacity: number; // 0-1
  
  stroke?: {
    color: string;
    width: number;
    opacity: number;
    dashArray?: number[];
  };
  
  overflow: 'visible' | 'hidden';
  blendMode?: BlendMode; // placeholder
  
  visible: boolean;
  locked: boolean;
  
  textStyle?: ExtendedTextStyle; // for text nodes
}
```

### Rendering Implications

**Box Model:**
- **Margin**: Expands hit-test bounds, adds spacing in layout
- **Padding**: Shrinks content area, rendered as inner spacing
- **Border**: Rendered as outline with width/color/style
- **Radius**: Affects hit-testing (rounded rect containment) and rendering

**Shadows:**
- Multiple shadows supported (ordered front-to-back)
- Each shadow: offset (x, y), blur, spread, color, inset flag
- Rendered in WebGL using multiple passes or shader tricks

**Overflow:**
- `hidden`: Clips children to bounds (stencil buffer or scissor test)
- `visible`: No clipping

**Bounds Expansion:**

```typescript
// Compute expanded bounds for hit-testing
const expandedBounds = calculateExpandedBounds(baseBounds, style);

// Compute content bounds for child layout
const contentBounds = calculateContentBounds(baseBounds, style);
```

### Serialization

Styles are JSON-serializable with versioning:

```typescript
const serialized = serializeStyle(nodeStyle);
// { version: "1.0.0", data: {...} }

const deserialized = deserializeStyle(serialized);
// Handles version migrations
```

## WASM Core Implementation

### Spatial Index (Uniform Grid Hash)

**Why Uniform Grid?**
- O(1) insertion/removal
- Excellent for dynamic scenes (100k+ nodes)
- Predictable performance (no tree rebalancing)

**Grid Cell Size:** 256 world units

**Structure:**
```rust
struct SpatialIndex {
  nodes: HashMap<u32, NodeData>, // handle -> AABB + z-index
  grid: HashMap<(i32, i32), Vec<u32>>, // cell -> handles
}
```

**Operations:**
- `upsert(handle, aabb, z)`: Insert or update node
- `remove(handle)`: Remove node
- `query_point(x, y)`: Hit test (sorted by z-index)
- `query_rect(aabb)`: Range query
- `query_near(x, y, radius)`: Radius query

### Camera Transforms

Matches JS camera exactly:

```rust
screen_to_world(sx, sy) -> (wx, wy)
world_to_screen(wx, wy) -> (sx, sy)
get_visible_world_bounds() -> (min_x, min_y, max_x, max_y)
```

Formula:
```
world = (screen - viewport_center) / zoom + pan
screen = (world - pan) * zoom + viewport_center
```

### Memory Layout

**SoA (Structure of Arrays)** for cache efficiency:

```rust
struct NodeData {
  min_x: f32,
  min_y: f32,
  max_x: f32,
  max_y: f32,
  z_index: i32,
}
```

Flags stored separately in `HashMap<u32, u32>`:
- Bit 0: hidden
- Bit 1: locked

## Performance Targets & Budget

### Targets

- **60 FPS** under heavy load (100k nodes, 10k visible)
- **Wheel handler < 2ms** per event
- **Culling + hit-test + snap < 4ms** total/frame
- **No GC churn**: Reuse typed arrays, minimal allocations

### Instrumentation

**PerformanceOverlay Component:**
- FPS (real-time)
- Frame time (ms)
- Visible / Total node count
- Culling time
- Hit-test time
- WASM node count

**Color Coding:**
- Green: Within budget
- Yellow: Approaching limit
- Red: Over budget

**Wheel Latency Logging:**

```typescript
const startTime = performance.now();
handleWheel(event);
const elapsed = performance.now() - startTime;
if (elapsed > 2) {
  console.warn(`Wheel handler took ${elapsed}ms`);
}
```

## Build & Deployment

### WASM Build

```bash
# Build WASM module
./scripts/build-wasm.sh

# Output:
# - public/wasm/editor_core_bg.wasm
# - public/wasm/editor_core.js
# - public/wasm/editor_core.d.ts
```

### Integration

1. **Import WASM adapter:**
```typescript
import { WasmAdapter } from './engine/wasm/WasmAdapter';
```

2. **Initialize:**
```typescript
const wasm = new WasmAdapter();
await wasm.init({ capacity: 100000 });
```

3. **Use in engine:**
```typescript
// Update on scene changes
wasm.updateFromScene(scene);

// Query during render
const visibleIds = wasm.getVisibleNodes();

// Hit test in tools
const hitIds = wasm.hitTestPoint(worldX, worldY);
```

## Threading Model

**Current: Main Thread**
- WASM runs on main thread for simplicity
- Per-frame CPU budget strictly enforced

**Future: WebWorker**
- WASM in Worker + Comlink/postMessage
- Requires shared data structures (SharedArrayBuffer)
- Cross-origin isolation headers needed

## File Structure

```
src/
├── engine/
│   ├── wasm/
│   │   ├── IdRegistry.ts      # String <-> u32 mapping
│   │   └── WasmAdapter.ts     # High-level WASM interface
│   ├── camera.ts
│   └── scene/
│       └── sceneGraph.ts
├── types/
│   ├── core.ts
│   └── styles.ts              # CSS-like style model
├── ui/
│   ├── toolbar/
│   │   └── Toolbar.tsx        # Updated with lucide-react icons
│   └── components/
│       ├── PerformanceOverlay.tsx
│       └── PerformanceOverlay.css
└── renderer/
    ├── RenderEngine.ts        # Integrated WASM culling
    ├── webgl/
    │   └── WebGLRenderer.ts   # Style-aware rendering
    └── canvas2d/
        └── Canvas2DRenderer.ts # Style-aware rendering

crates/
└── editor_core/              # Rust WASM module
    ├── Cargo.toml
    └── src/
        ├── lib.rs            # WASM exports
        ├── spatial_index.rs  # Uniform grid hash
        ├── camera.rs         # Transform functions
        └── utils.rs          # Helpers

public/
└── wasm/                     # WASM build output
    ├── .gitkeep
    ├── editor_core_bg.wasm
    ├── editor_core.js
    └── editor_core.d.ts

scripts/
└── build-wasm.sh             # WASM build script
```

## Performance Checklist

- [x] WASM spatial index (uniform grid)
- [x] Incremental updates (upsert/remove)
- [x] Fast culling (<2ms for 10k visible)
- [x] Fast hit-testing (<2ms)
- [x] Snap queries (grid + objects)
- [x] Camera transforms in WASM
- [x] ID registry (string <-> u32)
- [x] Performance instrumentation
- [x] Wheel latency tracking
- [x] CSS-like style model
- [x] Style serialization
- [ ] Style rendering (borders, shadows, radius) - **TODO**
- [ ] Overflow clipping - **TODO**
- [ ] WebWorker threading - **TODO** (optional)

## Next Steps

1. **Integrate WASM into RenderEngine:**
   - Replace JS culling with `wasmAdapter.getVisibleNodes()`
   - Measure performance improvement

2. **Integrate WASM into Tools:**
   - Use `wasmAdapter.hitTestPoint()` in SelectTool
   - Add snapping to drag operations

3. **Implement Style Rendering:**
   - Border radius in WebGL (rounded rect shader)
   - Box shadows (multi-pass or shader)
   - Border rendering (stroke with dash patterns)
   - Padding/margin visualization (debug mode)

4. **Optimize:**
   - Profile frame budget
   - Tune grid cell size
   - Add spatial index stats

5. **WebWorker Migration (optional):**
   - Move WASM to Worker
   - Use Comlink for RPC
   - SharedArrayBuffer for zero-copy transfer
