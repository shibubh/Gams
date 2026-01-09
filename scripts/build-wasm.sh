#!/bin/bash
# Build script for WASM module

set -e

echo "Building WASM module..."

cd crates/editor_core

# Build WASM with release optimizations
cargo build --target wasm32-unknown-unknown --release

# Generate TypeScript bindings
wasm-bindgen \
  --target web \
  --out-dir ../../public/wasm \
  target/wasm32-unknown-unknown/release/editor_core.wasm

echo "✅ WASM module built successfully"
echo "   Output: public/wasm/"
