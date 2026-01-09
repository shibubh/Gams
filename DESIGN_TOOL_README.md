# Canvas Design Tool - Production-Grade Figma-like Web Application

A scalable, production-ready infinite canvas design tool built with React 19, TypeScript, and WebGL2. Implements a multi-agent architecture with specialized rendering, interaction, and storage systems.

![Canvas Editor](https://github.com/user-attachments/assets/d6226467-7944-4df6-b5b1-b19d83c5bbeb)

## Features

### 🎨 Rendering Engine (WebGL2 + Canvas2D Fallback)
- Hardware-accelerated WebGL2 rendering with custom shaders
- Infinite canvas with smooth pan/zoom
- Zoom-to-cursor functionality
- Grid rendering with adaptive detail
- Shape rendering with batching for performance
- Selection outlines with visual feedback
- Canvas2D fallback for compatibility
- Visibility culling - only renders visible objects
- 60fps rendering with RAF throttling

### 🛠️ Tools & Interaction
- **Select Tool**: Click to select, drag to move objects, marquee selection
- **Pan Tool**: Navigate the infinite canvas
- **Rectangle Tool**: Create rectangles by dragging
- Spatial indexing (RBush) for fast hit-testing
- Grid snapping (50px increments)
- Object edge and center snapping
- Mouse wheel zoom with smooth interpolation
- Full keyboard shortcut support

### ⏱️ Command Pattern & History
- Complete undo/redo system
- Command pattern for all operations
- Command merging for smooth interactions
- Deterministic state replay
- History persistence across sessions

### 💾 Storage & Persistence
- IndexedDB for local storage
- Versioned JSON schema with Zod validation
- Schema migration system for backward compatibility
- Auto-save with intelligent debouncing (2s delay)
- Export designs to JSON
- Import with validation and migration
- Stable object IDs for referencing

### 🏗️ Architecture
- Clean separation: Engine / Renderer / Tools / Storage / UI
- React for UI chrome only - rendering is decoupled
- Scene graph with hierarchical transforms
- Matrix-based transformations (gl-matrix)
- Zustand for efficient state management
- Zero React re-renders during canvas interactions

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage

### Tools

- **Select Tool** (default): Click objects to select, drag to move, drag empty space for marquee selection
- **Pan Tool**: Click and drag to pan the canvas
- **Rectangle Tool**: Click and drag to create rectangles

### Keyboard Shortcuts

- `Cmd/Ctrl + Z` - Undo
- `Cmd/Ctrl + Shift + Z` - Redo
- `Escape` - Cancel current operation

### Mouse Controls

- **Scroll Wheel** - Zoom in/out (zoom to cursor)
- **Click** - Select object or activate tool
- **Drag** - Move objects or draw shapes depending on active tool

## Architecture

### Core Types (`/src/engine/core/types.ts`)
Shared interface contracts used across all modules:
- `SceneNode` - Base node types (rect, ellipse, line, text, frame, group)
- `DocumentModel` - Complete document structure
- `CameraState` - Viewport and zoom state
- `Tool` - Tool interface contract
- `Command` - Command pattern interface
- `Renderer` - Renderer interface
- `StorageAdapter` - Storage interface

### Renderer Agent (`/src/engine/renderer/`)
- `webgl-renderer.ts` - Main WebGL2 renderer with Canvas2D fallback
- `grid-renderer.ts` - Infinite grid background
- `rect-renderer.ts` - Rectangle shape renderer with batching
- `selection-renderer.ts` - Selection outline rendering

### Interaction Agent (`/src/engine/interaction/`)
- `tool-router.ts` - Routes pointer events to active tool
- `spatial-index.ts` - RBush-based spatial indexing
- `snapping-service.ts` - Grid and object snapping
- `commands.ts` - Command implementations
- `/tools/` - Tool implementations (select, pan, rect)

### Storage Agent (`/src/engine/storage/`)
- `indexeddb-adapter.ts` - IndexedDB persistence
- `schema.ts` - Zod schema validation
- `migrations.ts` - Version migration system
- `autosave-manager.ts` - Debounced auto-save

### Store (`/src/engine/store/`)
- `engine-store.ts` - Zustand-based state management

### UI (`/src/app/`)
- `CanvasEditor.tsx` - Main integration component

## Technical Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **WebGL2** - Hardware-accelerated rendering
- **gl-matrix** - Matrix mathematics
- **Zustand** - Lightweight state management
- **RBush** - R-tree spatial indexing
- **Zod** - Runtime schema validation
- **idb-keyval** - IndexedDB wrapper
- **nanoid** - Unique ID generation

## Project Structure

```
src/
├── engine/
│   ├── core/           # Shared types and utilities
│   │   ├── types.ts
│   │   ├── math.ts
│   │   └── node-utils.ts
│   ├── renderer/       # WebGL2 rendering
│   │   ├── webgl-renderer.ts
│   │   ├── grid-renderer.ts
│   │   ├── rect-renderer.ts
│   │   └── selection-renderer.ts
│   ├── interaction/    # Tools and hit-testing
│   │   ├── tool-router.ts
│   │   ├── spatial-index.ts
│   │   ├── snapping-service.ts
│   │   ├── commands.ts
│   │   └── tools/
│   ├── storage/        # Persistence
│   │   ├── indexeddb-adapter.ts
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   └── autosave-manager.ts
│   └── store/          # State management
│       └── engine-store.ts
└── app/                # React UI
    └── CanvasEditor.tsx
```

## Performance Considerations

- **Rendering**: Only visible objects are rendered (viewport culling)
- **Hit-testing**: Spatial index (RBush) for O(log n) queries
- **State Updates**: Zustand subscriptions prevent unnecessary React re-renders
- **WebGL**: Batched rendering for shapes of the same type
- **Auto-save**: Debounced to 2 seconds to avoid excessive writes

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Any browser with WebGL2 support
- Fallback to Canvas2D for older browsers

## Security

✅ Zero vulnerabilities found by CodeQL analysis  
✅ All dependencies verified against GitHub Advisory Database  
✅ No known security issues

## Future Enhancements

- Additional shape types (ellipse, line, text)
- Transform handles for resize/rotate
- Multi-selection with shift-click
- Grouping and hierarchy
- Layers panel
- Color picker and style editor
- Keyboard-only navigation
- Export to PNG/SVG
- Collaborative editing
- Plugin system

## License

MIT
