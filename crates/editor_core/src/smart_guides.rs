//! Smart Guides (Figma-style)
//! 
//! High-performance calculation of alignment guides, spacing guides,
//! and distance measurements for the infinite canvas editor.

use wasm_bindgen::prelude::*;
use std::collections::HashMap;

// ============================================================================
// Data Structures
// ============================================================================

/// Alignment guide (vertical or horizontal line showing alignment)
#[wasm_bindgen]
#[derive(Clone)]
pub struct AlignmentGuide {
    guide_type: u8, // 0 = vertical, 1 = horizontal
    position: f32,
    alignment_type: u8, // 0-5 mapping to edge-left, edge-right, etc.
    node_count: usize,
}

#[wasm_bindgen]
impl AlignmentGuide {
    #[wasm_bindgen(getter)]
    pub fn guide_type(&self) -> u8 {
        self.guide_type
    }

    #[wasm_bindgen(getter)]
    pub fn position(&self) -> f32 {
        self.position
    }

    #[wasm_bindgen(getter)]
    pub fn alignment_type(&self) -> u8 {
        self.alignment_type
    }

    #[wasm_bindgen(getter)]
    pub fn node_count(&self) -> usize {
        self.node_count
    }
}

/// Spacing guide (shows equal spacing between objects)
#[wasm_bindgen]
#[derive(Clone)]
pub struct SpacingGuide {
    guide_type: u8, // 0 = horizontal, 1 = vertical
    from_x: f32,
    from_y: f32,
    from_width: f32,
    from_height: f32,
    to_x: f32,
    to_y: f32,
    to_width: f32,
    to_height: f32,
    spacing: f32,
}

#[wasm_bindgen]
impl SpacingGuide {
    #[wasm_bindgen(getter)]
    pub fn guide_type(&self) -> u8 {
        self.guide_type
    }

    #[wasm_bindgen(getter)]
    pub fn from_x(&self) -> f32 {
        self.from_x
    }

    #[wasm_bindgen(getter)]
    pub fn from_y(&self) -> f32 {
        self.from_y
    }

    #[wasm_bindgen(getter)]
    pub fn from_width(&self) -> f32 {
        self.from_width
    }

    #[wasm_bindgen(getter)]
    pub fn from_height(&self) -> f32 {
        self.from_height
    }

    #[wasm_bindgen(getter)]
    pub fn to_x(&self) -> f32 {
        self.to_x
    }

    #[wasm_bindgen(getter)]
    pub fn to_y(&self) -> f32 {
        self.to_y
    }

    #[wasm_bindgen(getter)]
    pub fn to_width(&self) -> f32 {
        self.to_width
    }

    #[wasm_bindgen(getter)]
    pub fn to_height(&self) -> f32 {
        self.to_height
    }

    #[wasm_bindgen(getter)]
    pub fn spacing(&self) -> f32 {
        self.spacing
    }
}

/// Distance measurement (from object to nearest sibling or parent)
#[wasm_bindgen]
#[derive(Clone)]
pub struct DistanceMeasurement {
    from_x: f32,
    from_y: f32,
    to_x: f32,
    to_y: f32,
    direction: u8, // 0 = horizontal, 1 = vertical
    distance: f32,
}

#[wasm_bindgen]
impl DistanceMeasurement {
    #[wasm_bindgen(getter)]
    pub fn from_x(&self) -> f32 {
        self.from_x
    }

    #[wasm_bindgen(getter)]
    pub fn from_y(&self) -> f32 {
        self.from_y
    }

    #[wasm_bindgen(getter)]
    pub fn to_x(&self) -> f32 {
        self.to_x
    }

    #[wasm_bindgen(getter)]
    pub fn to_y(&self) -> f32 {
        self.to_y
    }

    #[wasm_bindgen(getter)]
    pub fn direction(&self) -> u8 {
        self.direction
    }

    #[wasm_bindgen(getter)]
    pub fn distance(&self) -> f32 {
        self.distance
    }
}

// ============================================================================
// Internal Helper Structures
// ============================================================================

struct NodeBounds {
    min_x: f32,
    min_y: f32,
    max_x: f32,
    max_y: f32,
}

impl NodeBounds {
    fn left(&self) -> f32 {
        self.min_x
    }

    fn right(&self) -> f32 {
        self.max_x
    }

    fn top(&self) -> f32 {
        self.min_y
    }

    fn bottom(&self) -> f32 {
        self.max_y
    }

    fn center_x(&self) -> f32 {
        (self.min_x + self.max_x) / 2.0
    }

    fn center_y(&self) -> f32 {
        (self.min_y + self.max_y) / 2.0
    }

    fn width(&self) -> f32 {
        self.max_x - self.min_x
    }

    fn height(&self) -> f32 {
        self.max_y - self.min_y
    }

    fn x(&self) -> f32 {
        self.min_x
    }

    fn y(&self) -> f32 {
        self.min_y
    }
}

// ============================================================================
// Alignment Type Constants
// ============================================================================

const EDGE_LEFT: u8 = 0;
const EDGE_RIGHT: u8 = 1;
const EDGE_TOP: u8 = 2;
const EDGE_BOTTOM: u8 = 3;
const CENTER_X: u8 = 4;
const CENTER_Y: u8 = 5;

// ============================================================================
// Smart Guide Calculations
// ============================================================================

/// Calculate alignment guides
/// Shows when edges or centers of objects align
pub fn calculate_alignment_guides(
    moving_bounds: (f32, f32, f32, f32), // (min_x, min_y, max_x, max_y)
    all_bounds: &[(f32, f32, f32, f32)],  // [(min_x, min_y, max_x, max_y), ...]
    threshold: f32,
) -> Vec<AlignmentGuide> {
    let mut guides = Vec::new();
    
    let moving = NodeBounds {
        min_x: moving_bounds.0,
        min_y: moving_bounds.1,
        max_x: moving_bounds.2,
        max_y: moving_bounds.3,
    };

    let left = moving.left();
    let right = moving.right();
    let center_x = moving.center_x();
    let top = moving.top();
    let bottom = moving.bottom();
    let center_y = moving.center_y();

    let mut vertical_alignments: HashMap<i32, (u8, usize)> = HashMap::new();
    let mut horizontal_alignments: HashMap<i32, (u8, usize)> = HashMap::new();

    for bounds in all_bounds {
        let node = NodeBounds {
            min_x: bounds.0,
            min_y: bounds.1,
            max_x: bounds.2,
            max_y: bounds.3,
        };

        let n_left = node.left();
        let n_right = node.right();
        let n_center_x = node.center_x();
        let n_top = node.top();
        let n_bottom = node.bottom();
        let n_center_y = node.center_y();

        // Check vertical alignments (x-axis)
        check_alignment(&mut vertical_alignments, left, n_left, threshold, EDGE_LEFT);
        check_alignment(&mut vertical_alignments, right, n_right, threshold, EDGE_RIGHT);
        check_alignment(&mut vertical_alignments, center_x, n_center_x, threshold, CENTER_X);
        check_alignment(&mut vertical_alignments, left, n_right, threshold, EDGE_LEFT);
        check_alignment(&mut vertical_alignments, right, n_left, threshold, EDGE_RIGHT);

        // Check horizontal alignments (y-axis)
        check_alignment(&mut horizontal_alignments, top, n_top, threshold, EDGE_TOP);
        check_alignment(&mut horizontal_alignments, bottom, n_bottom, threshold, EDGE_BOTTOM);
        check_alignment(&mut horizontal_alignments, center_y, n_center_y, threshold, CENTER_Y);
        check_alignment(&mut horizontal_alignments, top, n_bottom, threshold, EDGE_TOP);
        check_alignment(&mut horizontal_alignments, bottom, n_top, threshold, EDGE_BOTTOM);
    }

    // Convert vertical alignments to guides
    for (pos_key, (align_type, count)) in vertical_alignments {
        guides.push(AlignmentGuide {
            guide_type: 0, // vertical
            position: f32::from_bits(pos_key as u32),
            alignment_type: align_type,
            node_count: count,
        });
    }

    // Convert horizontal alignments to guides
    for (pos_key, (align_type, count)) in horizontal_alignments {
        guides.push(AlignmentGuide {
            guide_type: 1, // horizontal
            position: f32::from_bits(pos_key as u32),
            alignment_type: align_type,
            node_count: count,
        });
    }

    guides
}

fn check_alignment(
    map: &mut HashMap<i32, (u8, usize)>,
    pos1: f32,
    pos2: f32,
    threshold: f32,
    align_type: u8,
) {
    if (pos1 - pos2).abs() < threshold {
        let key = pos1.to_bits() as i32;
        map.entry(key)
            .and_modify(|(_, count)| *count += 1)
            .or_insert((align_type, 1));
    }
}

/// Calculate spacing guides
/// Shows when spacing between objects is equal
pub fn calculate_spacing_guides(
    moving_bounds: (f32, f32, f32, f32), // (min_x, min_y, max_x, max_y)
    all_bounds: &[(f32, f32, f32, f32)],  // [(min_x, min_y, max_x, max_y), ...]
) -> Vec<SpacingGuide> {
    let mut guides = Vec::new();
    
    let moving = NodeBounds {
        min_x: moving_bounds.0,
        min_y: moving_bounds.1,
        max_x: moving_bounds.2,
        max_y: moving_bounds.3,
    };

    // Find potential spacing matches
    let mut horizontal_spacings: HashMap<i32, Vec<(NodeBounds, NodeBounds)>> = HashMap::new();
    let mut vertical_spacings: HashMap<i32, Vec<(NodeBounds, NodeBounds)>> = HashMap::new();

    // Calculate spacings between all pairs of nodes (excluding moving node)
    for i in 0..all_bounds.len() {
        for j in (i + 1)..all_bounds.len() {
            let node1 = NodeBounds {
                min_x: all_bounds[i].0,
                min_y: all_bounds[i].1,
                max_x: all_bounds[i].2,
                max_y: all_bounds[i].3,
            };
            let node2 = NodeBounds {
                min_x: all_bounds[j].0,
                min_y: all_bounds[j].1,
                max_x: all_bounds[j].2,
                max_y: all_bounds[j].3,
            };

            // Horizontal spacing (left-right)
            if node2.left() > node1.right() {
                let spacing = node2.left() - node1.right();
                let spacing_key = spacing.to_bits() as i32;
                horizontal_spacings
                    .entry(spacing_key)
                    .or_insert_with(Vec::new)
                    .push((
                        NodeBounds { min_x: node1.min_x, min_y: node1.min_y, max_x: node1.max_x, max_y: node1.max_y },
                        NodeBounds { min_x: node2.min_x, min_y: node2.min_y, max_x: node2.max_x, max_y: node2.max_y },
                    ));
            }

            // Vertical spacing (top-bottom)
            if node2.top() > node1.bottom() {
                let spacing = node2.top() - node1.bottom();
                let spacing_key = spacing.to_bits() as i32;
                vertical_spacings
                    .entry(spacing_key)
                    .or_insert_with(Vec::new)
                    .push((
                        NodeBounds { min_x: node1.min_x, min_y: node1.min_y, max_x: node1.max_x, max_y: node1.max_y },
                        NodeBounds { min_x: node2.min_x, min_y: node2.min_y, max_x: node2.max_x, max_y: node2.max_y },
                    ));
            }
        }
    }

    // Check if moving node creates equal spacing
    for bounds in all_bounds {
        let node = NodeBounds {
            min_x: bounds.0,
            min_y: bounds.1,
            max_x: bounds.2,
            max_y: bounds.3,
        };

        // Horizontal spacing
        if node.left() > moving.right() {
            let spacing = node.left() - moving.right();
            let spacing_key = spacing.to_bits() as i32;
            if let Some(matches) = horizontal_spacings.get(&spacing_key) {
                if !matches.is_empty() {
                    guides.push(SpacingGuide {
                        guide_type: 0, // horizontal
                        from_x: moving.x(),
                        from_y: moving.y(),
                        from_width: moving.width(),
                        from_height: moving.height(),
                        to_x: node.x(),
                        to_y: node.y(),
                        to_width: node.width(),
                        to_height: node.height(),
                        spacing,
                    });
                }
            }
        } else if moving.left() > node.right() {
            let spacing = moving.left() - node.right();
            let spacing_key = spacing.to_bits() as i32;
            if let Some(matches) = horizontal_spacings.get(&spacing_key) {
                if !matches.is_empty() {
                    guides.push(SpacingGuide {
                        guide_type: 0, // horizontal
                        from_x: node.x(),
                        from_y: node.y(),
                        from_width: node.width(),
                        from_height: node.height(),
                        to_x: moving.x(),
                        to_y: moving.y(),
                        to_width: moving.width(),
                        to_height: moving.height(),
                        spacing,
                    });
                }
            }
        }

        // Vertical spacing
        if node.top() > moving.bottom() {
            let spacing = node.top() - moving.bottom();
            let spacing_key = spacing.to_bits() as i32;
            if let Some(matches) = vertical_spacings.get(&spacing_key) {
                if !matches.is_empty() {
                    guides.push(SpacingGuide {
                        guide_type: 1, // vertical
                        from_x: moving.x(),
                        from_y: moving.y(),
                        from_width: moving.width(),
                        from_height: moving.height(),
                        to_x: node.x(),
                        to_y: node.y(),
                        to_width: node.width(),
                        to_height: node.height(),
                        spacing,
                    });
                }
            }
        } else if moving.top() > node.bottom() {
            let spacing = moving.top() - node.bottom();
            let spacing_key = spacing.to_bits() as i32;
            if let Some(matches) = vertical_spacings.get(&spacing_key) {
                if !matches.is_empty() {
                    guides.push(SpacingGuide {
                        guide_type: 1, // vertical
                        from_x: node.x(),
                        from_y: node.y(),
                        from_width: node.width(),
                        from_height: node.height(),
                        to_x: moving.x(),
                        to_y: moving.y(),
                        to_width: moving.width(),
                        to_height: moving.height(),
                        spacing,
                    });
                }
            }
        }
    }

    guides
}

/// Calculate distance measurements
/// Shows distance from object to nearest siblings or parent bounds
pub fn calculate_distance_measurements(
    moving_bounds: (f32, f32, f32, f32),  // (min_x, min_y, max_x, max_y)
    all_bounds: &[(f32, f32, f32, f32)],   // [(min_x, min_y, max_x, max_y), ...]
    parent_bounds: Option<(f32, f32, f32, f32)>, // Optional parent container
) -> Vec<DistanceMeasurement> {
    let mut measurements = Vec::new();
    
    let moving = NodeBounds {
        min_x: moving_bounds.0,
        min_y: moving_bounds.1,
        max_x: moving_bounds.2,
        max_y: moving_bounds.3,
    };

    let mut nearest_left: Option<(NodeBounds, f32)> = None;
    let mut nearest_right: Option<(NodeBounds, f32)> = None;
    let mut nearest_top: Option<(NodeBounds, f32)> = None;
    let mut nearest_bottom: Option<(NodeBounds, f32)> = None;

    // Find nearest sibling objects on each side
    for bounds in all_bounds {
        let node = NodeBounds {
            min_x: bounds.0,
            min_y: bounds.1,
            max_x: bounds.2,
            max_y: bounds.3,
        };

        // Skip parent/container nodes (nodes that fully contain the moving node)
        if node.left() <= moving.left()
            && node.top() <= moving.top()
            && node.right() >= moving.right()
            && node.bottom() >= moving.bottom()
        {
            continue;
        }

        // Check left - object is to the left of selected
        if node.right() <= moving.left() {
            let distance = moving.left() - node.right();
            if nearest_left.is_none() || distance < nearest_left.as_ref().unwrap().1 {
                nearest_left = Some((
                    NodeBounds { min_x: node.min_x, min_y: node.min_y, max_x: node.max_x, max_y: node.max_y },
                    distance,
                ));
            }
        }

        // Check right - object is to the right of selected
        if node.left() >= moving.right() {
            let distance = node.left() - moving.right();
            if nearest_right.is_none() || distance < nearest_right.as_ref().unwrap().1 {
                nearest_right = Some((
                    NodeBounds { min_x: node.min_x, min_y: node.min_y, max_x: node.max_x, max_y: node.max_y },
                    distance,
                ));
            }
        }

        // Check top - object is above selected
        if node.bottom() <= moving.top() {
            let distance = moving.top() - node.bottom();
            if nearest_top.is_none() || distance < nearest_top.as_ref().unwrap().1 {
                nearest_top = Some((
                    NodeBounds { min_x: node.min_x, min_y: node.min_y, max_x: node.max_x, max_y: node.max_y },
                    distance,
                ));
            }
        }

        // Check bottom - object is below selected
        if node.top() >= moving.bottom() {
            let distance = node.top() - moving.bottom();
            if nearest_bottom.is_none() || distance < nearest_bottom.as_ref().unwrap().1 {
                nearest_bottom = Some((
                    NodeBounds { min_x: node.min_x, min_y: node.min_y, max_x: node.max_x, max_y: node.max_y },
                    distance,
                ));
            }
        }
    }

    // Add measurements for nearest objects or parent bounds
    let center_y = moving.center_y();
    let center_x = moving.center_x();

    // Left side
    if let Some((node, distance)) = nearest_left {
        measurements.push(DistanceMeasurement {
            from_x: moving.left(),
            from_y: center_y,
            to_x: node.right(),
            to_y: center_y,
            direction: 0, // horizontal
            distance,
        });
    } else if let Some((px, _py, _pwidth, _pheight)) = parent_bounds {
        let dist_to_parent_left = moving.left() - px;
        if dist_to_parent_left > 0.0 {
            measurements.push(DistanceMeasurement {
                from_x: moving.left(),
                from_y: center_y,
                to_x: px,
                to_y: center_y,
                direction: 0, // horizontal
                distance: dist_to_parent_left,
            });
        }
    }

    // Right side
    if let Some((node, distance)) = nearest_right {
        measurements.push(DistanceMeasurement {
            from_x: moving.right(),
            from_y: center_y,
            to_x: node.left(),
            to_y: center_y,
            direction: 0, // horizontal
            distance,
        });
    } else if let Some((px, _py, pwidth, _pheight)) = parent_bounds {
        let dist_to_parent_right = (px + pwidth) - moving.right();
        if dist_to_parent_right > 0.0 {
            measurements.push(DistanceMeasurement {
                from_x: moving.right(),
                from_y: center_y,
                to_x: px + pwidth,
                to_y: center_y,
                direction: 0, // horizontal
                distance: dist_to_parent_right,
            });
        }
    }

    // Top side
    if let Some((node, distance)) = nearest_top {
        measurements.push(DistanceMeasurement {
            from_x: center_x,
            from_y: moving.top(),
            to_x: center_x,
            to_y: node.bottom(),
            direction: 1, // vertical
            distance,
        });
    } else if let Some((_px, py, _pwidth, _pheight)) = parent_bounds {
        let dist_to_parent_top = moving.top() - py;
        if dist_to_parent_top > 0.0 {
            measurements.push(DistanceMeasurement {
                from_x: center_x,
                from_y: moving.top(),
                to_x: center_x,
                to_y: py,
                direction: 1, // vertical
                distance: dist_to_parent_top,
            });
        }
    }

    // Bottom side
    if let Some((node, distance)) = nearest_bottom {
        measurements.push(DistanceMeasurement {
            from_x: center_x,
            from_y: moving.bottom(),
            to_x: center_x,
            to_y: node.top(),
            direction: 1, // vertical
            distance,
        });
    } else if let Some((_px, py, _pwidth, pheight)) = parent_bounds {
        let dist_to_parent_bottom = (py + pheight) - moving.bottom();
        if dist_to_parent_bottom > 0.0 {
            measurements.push(DistanceMeasurement {
                from_x: center_x,
                from_y: moving.bottom(),
                to_x: center_x,
                to_y: py + pheight,
                direction: 1, // vertical
                distance: dist_to_parent_bottom,
            });
        }
    }

    measurements
}
