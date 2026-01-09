//! Uniform Grid Hash-based Spatial Index
//!
//! High-performance spatial indexing for dynamic scenes with frequent updates.
//! Uses a uniform grid with hash-based lookup for O(1) insertion/removal
//! and efficient spatial queries.

use std::collections::HashMap;

const GRID_CELL_SIZE: f32 = 256.0;

/// AABB bounds in SoA layout for cache efficiency
#[derive(Clone)]
struct NodeData {
    min_x: f32,
    min_y: f32,
    max_x: f32,
    max_y: f32,
    z_index: i32,
}

/// Spatial index using uniform grid hashing
pub struct SpatialIndex {
    /// Node data stored in Structure of Arrays (SoA) layout
    nodes: HashMap<u32, NodeData>,
    
    /// Grid cells mapping to node handles
    grid: HashMap<(i32, i32), Vec<u32>>,
}

impl SpatialIndex {
    pub fn new(capacity: usize) -> Self {
        Self {
            nodes: HashMap::with_capacity(capacity),
            grid: HashMap::with_capacity(capacity * 4),
        }
    }

    /// Insert or update a node
    pub fn upsert(
        &mut self,
        handle: u32,
        min_x: f32,
        min_y: f32,
        max_x: f32,
        max_y: f32,
        z_index: i32,
    ) {
        // Remove old entry if exists
        if self.nodes.contains_key(&handle) {
            self.remove(handle);
        }

        // Store node data
        let node_data = NodeData {
            min_x,
            min_y,
            max_x,
            max_y,
            z_index,
        };

        // Compute grid cells this node overlaps
        let cells = self.compute_cells(min_x, min_y, max_x, max_y);

        // Add to grid cells
        for cell in cells {
            self.grid.entry(cell).or_insert_with(Vec::new).push(handle);
        }

        self.nodes.insert(handle, node_data);
    }

    /// Remove a node
    pub fn remove(&mut self, handle: u32) {
        if let Some(node_data) = self.nodes.remove(&handle) {
            // Compute cells and remove from grid
            let cells = self.compute_cells(
                node_data.min_x,
                node_data.min_y,
                node_data.max_x,
                node_data.max_y,
            );

            for cell in cells {
                if let Some(handles) = self.grid.get_mut(&cell) {
                    handles.retain(|&h| h != handle);
                    if handles.is_empty() {
                        self.grid.remove(&cell);
                    }
                }
            }
        }
    }

    /// Query nodes at a point, returns sorted by z-index (topmost first)
    pub fn query_point(&self, x: f32, y: f32) -> Vec<u32> {
        let cell = self.world_to_cell(x, y);
        
        let mut hits = Vec::new();

        if let Some(handles) = self.grid.get(&cell) {
            for &handle in handles {
                if let Some(node) = self.nodes.get(&handle) {
                    if x >= node.min_x && x <= node.max_x && y >= node.min_y && y <= node.max_y {
                        hits.push((handle, node.z_index));
                    }
                }
            }
        }

        // Sort by z-index descending (topmost first)
        hits.sort_by(|a, b| b.1.cmp(&a.1));
        hits.into_iter().map(|(h, _)| h).collect()
    }

    /// Query nodes within a rectangle
    pub fn query_rect(&self, min_x: f32, min_y: f32, max_x: f32, max_y: f32) -> Vec<u32> {
        let cells = self.compute_cells(min_x, min_y, max_x, max_y);
        let mut candidates = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for cell in cells {
            if let Some(handles) = self.grid.get(&cell) {
                for &handle in handles {
                    if seen.insert(handle) {
                        if let Some(node) = self.nodes.get(&handle) {
                            // AABB intersection test
                            if !(node.max_x < min_x
                                || node.min_x > max_x
                                || node.max_y < min_y
                                || node.min_y > max_y)
                            {
                                candidates.push(handle);
                            }
                        }
                    }
                }
            }
        }

        candidates
    }

    /// Query nodes near a point (within radius)
    pub fn query_near(&self, x: f32, y: f32, radius: f32) -> Vec<u32> {
        self.query_rect(x - radius, y - radius, x + radius, y + radius)
    }

    /// Get bounds for a node
    pub fn get_bounds(&self, handle: u32) -> Option<(f32, f32, f32, f32)> {
        self.nodes
            .get(&handle)
            .map(|n| (n.min_x, n.min_y, n.max_x, n.max_y))
    }

    /// Get node count
    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    /// Clear all nodes
    pub fn clear(&mut self) {
        self.nodes.clear();
        self.grid.clear();
    }

    // ========================================================================
    // Internal Helpers
    // ========================================================================

    fn world_to_cell(&self, x: f32, y: f32) -> (i32, i32) {
        let cell_x = (x / GRID_CELL_SIZE).floor() as i32;
        let cell_y = (y / GRID_CELL_SIZE).floor() as i32;
        (cell_x, cell_y)
    }

    fn compute_cells(&self, min_x: f32, min_y: f32, max_x: f32, max_y: f32) -> Vec<(i32, i32)> {
        let (min_cell_x, min_cell_y) = self.world_to_cell(min_x, min_y);
        let (max_cell_x, max_cell_y) = self.world_to_cell(max_x, max_y);

        let mut cells = Vec::new();
        for cy in min_cell_y..=max_cell_y {
            for cx in min_cell_x..=max_cell_x {
                cells.push((cx, cy));
            }
        }
        cells
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_insert_and_query() {
        let mut index = SpatialIndex::new(100);
        
        // Insert a node
        index.upsert(1, 0.0, 0.0, 100.0, 100.0, 0);
        
        // Query point inside
        let hits = index.query_point(50.0, 50.0);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0], 1);
        
        // Query point outside
        let hits = index.query_point(200.0, 200.0);
        assert_eq!(hits.len(), 0);
    }

    #[test]
    fn test_remove() {
        let mut index = SpatialIndex::new(100);
        
        index.upsert(1, 0.0, 0.0, 100.0, 100.0, 0);
        assert_eq!(index.len(), 1);
        
        index.remove(1);
        assert_eq!(index.len(), 0);
        
        let hits = index.query_point(50.0, 50.0);
        assert_eq!(hits.len(), 0);
    }

    #[test]
    fn test_z_index_ordering() {
        let mut index = SpatialIndex::new(100);
        
        // Insert overlapping nodes with different z-indices
        index.upsert(1, 0.0, 0.0, 100.0, 100.0, 1);
        index.upsert(2, 0.0, 0.0, 100.0, 100.0, 5);
        index.upsert(3, 0.0, 0.0, 100.0, 100.0, 3);
        
        // Query should return in z-index order (highest first)
        let hits = index.query_point(50.0, 50.0);
        assert_eq!(hits, vec![2, 3, 1]);
    }
}
