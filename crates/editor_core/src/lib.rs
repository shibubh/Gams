//! Editor Core WASM Module
//! 
//! High-performance spatial indexing, culling, hit-testing, and snapping
//! for the infinite canvas editor.
//!
//! This module runs in a WebWorker and handles CPU-intensive operations:
//! - Camera transforms (screen <-> world)
//! - Spatial indexing (uniform grid hash)
//! - Viewport culling
//! - Hit-testing queries
//! - Snapping candidate generation

mod spatial_index;
mod camera;
mod utils;
mod smart_guides;

use wasm_bindgen::prelude::*;
use std::collections::HashMap;

pub use spatial_index::SpatialIndex;
pub use camera::Camera;
pub use smart_guides::{AlignmentGuide, SpacingGuide, DistanceMeasurement};

// ============================================================================
// Engine State
// ============================================================================

/// Main engine struct managing all spatial operations
#[wasm_bindgen]
pub struct EditorCore {
    spatial_index: SpatialIndex,
    camera: Camera,
    node_flags: HashMap<u32, u32>,
}

#[wasm_bindgen]
impl EditorCore {
    /// Initialize the editor core with expected capacity
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: usize) -> Self {
        utils::set_panic_hook();
        
        Self {
            spatial_index: SpatialIndex::new(capacity),
            camera: Camera::new(),
            node_flags: HashMap::with_capacity(capacity),
        }
    }

    /// Insert or update a node in the spatial index
    #[wasm_bindgen]
    pub fn upsert_node(
        &mut self,
        handle: u32,
        min_x: f32,
        min_y: f32,
        max_x: f32,
        max_y: f32,
        z_index: i32,
        flags: u32,
    ) {
        self.spatial_index.upsert(handle, min_x, min_y, max_x, max_y, z_index);
        self.node_flags.insert(handle, flags);
    }

    /// Remove a node from the spatial index
    #[wasm_bindgen]
    pub fn remove_node(&mut self, handle: u32) {
        self.spatial_index.remove(handle);
        self.node_flags.remove(&handle);
    }

    /// Update camera transform
    #[wasm_bindgen]
    pub fn set_camera(
        &mut self,
        zoom: f32,
        pan_x: f32,
        pan_y: f32,
        viewport_w: f32,
        viewport_h: f32,
        dpr: f32,
    ) {
        self.camera.set(zoom, pan_x, pan_y, viewport_w, viewport_h, dpr);
    }

    /// Perform viewport culling and return visible node handles
    #[wasm_bindgen]
    pub fn cull_visible(&self) -> Vec<u32> {
        let visible_bounds = self.camera.get_visible_world_bounds();
        let mut visible = self.spatial_index.query_rect(
            visible_bounds.0,
            visible_bounds.1,
            visible_bounds.2,
            visible_bounds.3,
        );

        // Filter out hidden/locked nodes
        visible.retain(|&handle| {
            if let Some(&flags) = self.node_flags.get(&handle) {
                // flag bits: bit 0 = hidden, bit 1 = locked
                (flags & 0x1) == 0 // not hidden
            } else {
                true
            }
        });

        visible
    }

    /// Hit test at a world point, returns handles sorted by z-index (topmost first)
    #[wasm_bindgen]
    pub fn hit_test_point(&self, world_x: f32, world_y: f32) -> Vec<u32> {
        let mut hits = self.spatial_index.query_point(world_x, world_y);
        
        // Filter out hidden/locked nodes
        hits.retain(|&handle| {
            if let Some(&flags) = self.node_flags.get(&handle) {
                (flags & 0x3) == 0 // not hidden and not locked
            } else {
                true
            }
        });

        hits
    }

    /// Query nodes within a rectangle
    #[wasm_bindgen]
    pub fn query_rect(
        &self,
        min_x: f32,
        min_y: f32,
        max_x: f32,
        max_y: f32,
    ) -> Vec<u32> {
        self.spatial_index.query_rect(min_x, min_y, max_x, max_y)
    }

    /// Query nodes near a point (for snapping)
    #[wasm_bindgen]
    pub fn query_near(&self, world_x: f32, world_y: f32, radius: f32) -> Vec<u32> {
        self.spatial_index.query_near(world_x, world_y, radius)
    }

    /// Convert screen coordinates to world coordinates
    #[wasm_bindgen]
    pub fn screen_to_world(&self, screen_x: f32, screen_y: f32) -> Vec<f32> {
        let (wx, wy) = self.camera.screen_to_world(screen_x, screen_y);
        vec![wx, wy]
    }

    /// Convert world coordinates to screen coordinates
    #[wasm_bindgen]
    pub fn world_to_screen(&self, world_x: f32, world_y: f32) -> Vec<f32> {
        let (sx, sy) = self.camera.world_to_screen(world_x, world_y);
        vec![sx, sy]
    }

    /// Get node count (for debugging)
    #[wasm_bindgen]
    pub fn get_node_count(&self) -> usize {
        self.spatial_index.len()
    }

    /// Clear all nodes
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.spatial_index.clear();
        self.node_flags.clear();
    }
}

// ============================================================================
// Snap Result Struct
// ============================================================================

#[wasm_bindgen]
pub struct SnapResult {
    snapped: bool,
    x: f32,
    y: f32,
    guide_count: usize,
}

#[wasm_bindgen]
impl SnapResult {
    #[wasm_bindgen(getter)]
    pub fn snapped(&self) -> bool {
        self.snapped
    }

    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f32 {
        self.x
    }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f32 {
        self.y
    }

    #[wasm_bindgen(getter)]
    pub fn guide_count(&self) -> usize {
        self.guide_count
    }
}

#[wasm_bindgen]
impl EditorCore {
    /// Snap a point to nearby edges/centers
    #[wasm_bindgen]
    pub fn snap_point(
        &self,
        world_x: f32,
        world_y: f32,
        snap_threshold: f32,
        grid_size: f32,
        enable_grid: bool,
        enable_objects: bool,
    ) -> SnapResult {
        let mut snapped_x = world_x;
        let mut snapped_y = world_y;
        let mut snapped = false;
        let mut guide_count = 0;

        // Grid snapping
        if enable_grid && grid_size > 0.0 {
            let grid_x = (world_x / grid_size).round() * grid_size;
            let grid_y = (world_y / grid_size).round() * grid_size;
            
            if (world_x - grid_x).abs() < snap_threshold {
                snapped_x = grid_x;
                snapped = true;
                guide_count += 1;
            }
            if (world_y - grid_y).abs() < snap_threshold {
                snapped_y = grid_y;
                snapped = true;
                guide_count += 1;
            }
        }

        // Object snapping
        if enable_objects {
            let nearby = self.query_near(world_x, world_y, snap_threshold * 3.0);
            
            // Get bounds for nearby nodes and find snap candidates
            for &handle in &nearby {
                if let Some(bounds) = self.spatial_index.get_bounds(handle) {
                    // Snap to edges and center
                    let edges_x = [bounds.0, (bounds.0 + bounds.2) / 2.0, bounds.2];
                    let edges_y = [bounds.1, (bounds.1 + bounds.3) / 2.0, bounds.3];

                    for &edge_x in &edges_x {
                        if (world_x - edge_x).abs() < snap_threshold {
                            snapped_x = edge_x;
                            snapped = true;
                            guide_count += 1;
                        }
                    }

                    for &edge_y in &edges_y {
                        if (world_y - edge_y).abs() < snap_threshold {
                            snapped_y = edge_y;
                            snapped = true;
                            guide_count += 1;
                        }
                    }
                }
            }
        }

        SnapResult {
            snapped,
            x: snapped_x,
            y: snapped_y,
            guide_count,
        }
    }

    /// Calculate alignment guides (Figma-style)
    /// Shows when edges or centers of objects align
    #[wasm_bindgen]
    pub fn calculate_alignment_guides(
        &self,
        moving_handle: u32,
        visible_handles: Vec<u32>,
        threshold: f32,
    ) -> Vec<AlignmentGuide> {
        // Get bounds for moving node
        let moving_bounds = match self.spatial_index.get_bounds(moving_handle) {
            Some(bounds) => bounds,
            None => return Vec::new(),
        };

        // Get bounds for all visible nodes (excluding the moving node)
        let mut all_bounds = Vec::new();
        for &handle in &visible_handles {
            if handle != moving_handle {
                if let Some(bounds) = self.spatial_index.get_bounds(handle) {
                    all_bounds.push(bounds);
                }
            }
        }

        smart_guides::calculate_alignment_guides(moving_bounds, &all_bounds, threshold)
    }

    /// Calculate spacing guides (Figma-style)
    /// Shows when spacing between objects is equal
    #[wasm_bindgen]
    pub fn calculate_spacing_guides(
        &self,
        moving_handle: u32,
        visible_handles: Vec<u32>,
    ) -> Vec<SpacingGuide> {
        // Get bounds for moving node
        let moving_bounds = match self.spatial_index.get_bounds(moving_handle) {
            Some(bounds) => bounds,
            None => return Vec::new(),
        };

        // Get bounds for all visible nodes (excluding the moving node)
        let mut all_bounds = Vec::new();
        for &handle in &visible_handles {
            if handle != moving_handle {
                if let Some(bounds) = self.spatial_index.get_bounds(handle) {
                    all_bounds.push(bounds);
                }
            }
        }

        smart_guides::calculate_spacing_guides(moving_bounds, &all_bounds)
    }

    /// Calculate distance measurements
    /// Shows distance from object to nearest siblings or parent bounds
    #[wasm_bindgen]
    pub fn calculate_distance_measurements(
        &self,
        moving_handle: u32,
        visible_handles: Vec<u32>,
        parent_x: Option<f32>,
        parent_y: Option<f32>,
        parent_width: Option<f32>,
        parent_height: Option<f32>,
    ) -> Vec<DistanceMeasurement> {
        // Get bounds for moving node
        let moving_bounds = match self.spatial_index.get_bounds(moving_handle) {
            Some(bounds) => bounds,
            None => return Vec::new(),
        };

        // Get bounds for all visible nodes (excluding the moving node)
        let mut all_bounds = Vec::new();
        for &handle in &visible_handles {
            if handle != moving_handle {
                if let Some(bounds) = self.spatial_index.get_bounds(handle) {
                    all_bounds.push(bounds);
                }
            }
        }

        // Build parent bounds if provided
        let parent_bounds = match (parent_x, parent_y, parent_width, parent_height) {
            (Some(x), Some(y), Some(w), Some(h)) => Some((x, y, w, h)),
            _ => None,
        };

        smart_guides::calculate_distance_measurements(moving_bounds, &all_bounds, parent_bounds)
    }
}
