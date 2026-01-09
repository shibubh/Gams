# WASM Performance Layer - Quick Start Guide

## Overview

This document explains how to use the WASM-accelerated performance layer and CSS-like styling system in the infinite canvas editor.

## Features

### 1. WASM Performance Acceleration

- **Spatial Indexing**: Uniform grid hash for O(1) insertion/removal
- **Viewport Culling**: Fast queries to get only visible nodes
- **Hit Testing**: Accurate point-in-bounds tests with z-order
- **Snapping**: Grid and object snapping for precise alignment
- **Camera Transforms**: Screen ↔ world coordinate conversion

### 2. CSS-like Styling

Complete box model and visual properties:

- **Box Model**: margin, padding, border (width, color, style), border-radius
- **Background**: solid colors, gradients (placeholder), images (placeholder)
- **Shadows**: Multiple box-shadows with offset, blur, spread, color, inset
- **Opacity**: Per-node transparency
- **Stroke**: Color, width, dash patterns
- **Text**: Font family, size, weight, align, line-height, color
- **Overflow**: Clipping control (`visible` | `hidden`)
- **Blend Modes**: Placeholder for future implementation

### 3. Performance Monitoring

Real-time performance overlay shows:
- **FPS**: Frames per second
- **Frame Time**: Milliseconds per frame
- **Visible/Total**: Node counts
- **Cull Time**: WASM culling duration
- **Hit-test Time**: Query performance
- **WASM Nodes**: Spatial index size

## Building the Project

### Prerequisites

- Node.js 18+
- Rust 1.70+ with `wasm32-unknown-unknown` target
- `wasm-bindgen-cli` (installed automatically during first build)

### Build Steps

```bash
# Install dependencies
npm install

# Build everything (WASM + TypeScript + Vite)
npm run build

# Or just build WASM module
npm run build:wasm

# Development mode
npm run dev
```

The build process:
1. Compiles Rust → WASM (`crates/editor_core`)
2. Generates TypeScript bindings (`public/wasm/*.ts`)
3. Bundles app with Vite

## Using the WASM Layer

### Automatic Integration

The WASM layer is automatically initialized when the Canvas component mounts. No manual setup required!

```typescript
// Canvas.tsx automatically:
// 1. Creates WasmAdapter
// 2. Initializes WASM module
// 3. Updates spatial index on scene changes
// 4. Uses WASM for culling during render
```

### Performance Overlay

Toggle the performance overlay:

**Keyboard**: Press `Shift + P`

The overlay shows real-time metrics color-coded:
- 🟢 Green: Within budget
- 🟡 Yellow: Approaching limit
- 🔴 Red: Over budget

### Performance Targets

| Metric | Target | Color Threshold |
|--------|--------|----------------|
| FPS | ≥58 fps | Red <45, Yellow <58, Green ≥58 |
| Frame Time | ≤16.67ms | Red >25ms, Yellow >16.67ms, Green ≤16.67ms |
| Cull Time | <2ms | Red >3ms, Yellow >2ms, Green <2ms |
| Hit Test | <2ms | Red >3ms, Yellow >2ms, Green <2ms |
| Wheel Latency | <2ms | Logged if >2ms |

### Styling Nodes

Use the CSS-like style model:

```typescript
import { 
  createDefaultNodeStyle, 
  createDefaultBoxModel 
} from './types/styles';

// Create a styled rectangle
const styledRect = createRectangle('Styled Box', bounds, {
  boxModel: {
    margin: { t: 10, r: 10, b: 10, l: 10 },
    padding: { t: 20, r: 20, b: 20, l: 20 },
    border: {
      width: { t: 2, r: 2, b: 2, l: 2 },
      color: '#3b82f6',
      style: 'solid',
    },
    radius: { tl: 8, tr: 8, br: 8, bl: 8 },
  },
  background: {
    color: '#ffffff',
  },
  shadows: [
    {
      x: 0,
      y: 4,
      blur: 6,
      spread: -1,
      color: 'rgba(0, 0, 0, 0.1)',
    },
    {
      x: 0,
      y: 2,
      blur: 4,
      spread: -1,
      color: 'rgba(0, 0, 0, 0.06)',
    },
  ],
  opacity: 1,
  visible: true,
  locked: false,
});
```

### Bounds Calculation with Box Model

```typescript
import { 
  calculateExpandedBounds, 
  calculateContentBounds 
} from './types/styles';

// Get hit-test bounds (includes margin + border)
const hitBounds = calculateExpandedBounds(node.bounds, node.style);

// Get content bounds (excludes padding + border)
const contentBounds = calculateContentBounds(node.bounds, node.style);
```

### Style Serialization

Styles are versioned and JSON-serializable:

```typescript
import { serializeStyle, deserializeStyle } from './types/styles';

// Save
const serialized = serializeStyle(nodeStyle);
localStorage.setItem('savedStyle', JSON.stringify(serialized));

// Load
const loaded = JSON.parse(localStorage.getItem('savedStyle')!);
const nodeStyle = deserializeStyle(loaded);
// Handles version migrations automatically
```

## Architecture

### Data Flow

```
Scene Update
  ↓
WasmAdapter.updateFromScene()
  ↓
WASM Spatial Index (incremental update)
  ↓
Camera Pan/Zoom
  ↓
WasmAdapter.setCamera()
  ↓
RenderEngine.render()
  ↓
WasmAdapter.getVisibleNodes()  ← WASM culling
  ↓
Render only visible nodes
```

### Module Structure

```
src/
├── engine/
│   └── wasm/
│       ├── IdRegistry.ts       # String ↔ u32 mapping
│       └── WasmAdapter.ts      # High-level API
├── types/
│   └── styles.ts               # CSS-like style model
├── ui/
│   └── components/
│       └── PerformanceOverlay.tsx
└── renderer/
    └── RenderEngine.ts         # Integrated WASM culling

crates/
└── editor_core/               # Rust WASM module
    └── src/
        ├── lib.rs             # WASM exports
        ├── spatial_index.rs   # Uniform grid
        └── camera.rs          # Transforms
```

## Debugging

### Enable Verbose Logging

The system logs warnings for slow operations:

```
[WASM] Culling took 3.45ms  // > 2ms threshold
[Canvas] Wheel handler took 3.21ms (target: <2ms)
[RenderEngine] Slow frame: 18.43ms  // > 16.67ms
```

### Inspect WASM State

```typescript
// Get current WASM node count
const engine = engineRef.current;
const count = engine.getWasmAdapter().getNodeCount();
console.log(`WASM tracking ${count} nodes`);

// Check if WASM initialized
const isReady = engine.getWasmAdapter().isInitialized();
```

### Performance Profiling

Use Chrome DevTools:
1. Open Performance tab
2. Start recording
3. Interact with canvas (pan, zoom, create shapes)
4. Stop recording
5. Look for:
   - `RenderEngine.render()` should be <16.67ms
   - `WasmAdapter.getVisibleNodes()` should be <2ms
   - `wheel` events should complete in <2ms

## Limitations & Future Work

### Current Limitations

1. **Style Rendering**: Box model properties defined but not yet rendered
   - Border radius ✅ defined, ❌ not rendered
   - Shadows ✅ defined, ❌ not rendered
   - Advanced borders ✅ defined, ❌ not rendered

2. **Threading**: WASM runs on main thread (WebWorker support planned)

3. **Snapping**: Basic implementation (enhancement planned)

### Planned Enhancements

- [ ] WebWorker threading with SharedArrayBuffer
- [ ] Border radius rendering (rounded rect shader)
- [ ] Box shadow rendering (multi-pass or shader)
- [ ] Border styles (dashed, dotted) rendering
- [ ] Overflow clipping implementation
- [ ] Blend modes implementation
- [ ] Background gradients rendering
- [ ] Advanced snapping (smart guides)

## Performance Tips

### For 60 FPS with 100k+ Nodes

1. **Keep visible count manageable**: Aim for <10k visible nodes
2. **Use appropriate zoom levels**: Don't zoom too far out
3. **Batch scene updates**: Update many nodes at once, not one-by-one
4. **Monitor the overlay**: Keep an eye on Shift+P metrics
5. **Profile regularly**: Use Chrome DevTools to catch regressions

### Optimizing Scenes

```typescript
// ✅ Good: Batch update
const updatedScene = nodes.reduce(
  (scene, node) => updateNode(scene, node.id, node.updates),
  rootScene
);
engine.setScene(updatedScene);

// ❌ Bad: Many individual updates
nodes.forEach(node => {
  const updated = updateNode(rootScene, node.id, node.updates);
  engine.setScene(updated);  // Triggers WASM update each time!
});
```

## Troubleshooting

### WASM Failed to Initialize

```
[RenderEngine] WASM initialization failed: ...
```

**Solution**: App falls back to JS culling automatically. Check:
- WASM files present in `public/wasm/`
- No CORS issues (run from local server, not `file://`)
- Browser supports WASM (all modern browsers do)

### Slow Performance

```
[RenderEngine] Slow frame: 25.43ms
```

**Solution**:
1. Check Performance Overlay (Shift+P)
2. Reduce visible node count (zoom in)
3. Profile with Chrome DevTools
4. Ensure WASM initialized successfully

### Build Errors

```
error: target `wasm32-unknown-unknown` not found
```

**Solution**:
```bash
rustup target add wasm32-unknown-unknown
```

## License

MIT

## Contributing

See [WASM_ARCHITECTURE.md](./WASM_ARCHITECTURE.md) for detailed architecture docs.
