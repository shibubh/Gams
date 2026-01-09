//! Camera transform system for screen <-> world coordinate conversion

pub struct Camera {
    zoom: f32,
    pan_x: f32,
    pan_y: f32,
    viewport_w: f32,
    viewport_h: f32,
    dpr: f32,
}

impl Camera {
    pub fn new() -> Self {
        Self {
            zoom: 1.0,
            pan_x: 0.0,
            pan_y: 0.0,
            viewport_w: 800.0,
            viewport_h: 600.0,
            dpr: 1.0,
        }
    }

    pub fn set(
        &mut self,
        zoom: f32,
        pan_x: f32,
        pan_y: f32,
        viewport_w: f32,
        viewport_h: f32,
        dpr: f32,
    ) {
        self.zoom = zoom;
        self.pan_x = pan_x;
        self.pan_y = pan_y;
        self.viewport_w = viewport_w;
        self.viewport_h = viewport_h;
        self.dpr = dpr;
    }

    /// Convert screen coordinates to world coordinates
    pub fn screen_to_world(&self, screen_x: f32, screen_y: f32) -> (f32, f32) {
        // Reverse the view transform:
        // 1. Translate from viewport center
        // 2. Scale by zoom
        // 3. Translate by pan
        
        let centered_x = screen_x - self.viewport_w / 2.0;
        let centered_y = screen_y - self.viewport_h / 2.0;
        
        let world_x = centered_x / self.zoom + self.pan_x;
        let world_y = centered_y / self.zoom + self.pan_y;
        
        (world_x, world_y)
    }

    /// Convert world coordinates to screen coordinates
    pub fn world_to_screen(&self, world_x: f32, world_y: f32) -> (f32, f32) {
        // Apply view transform:
        // 1. Translate by -pan
        // 2. Scale by zoom
        // 3. Translate to viewport center
        
        let translated_x = world_x - self.pan_x;
        let translated_y = world_y - self.pan_y;
        
        let scaled_x = translated_x * self.zoom;
        let scaled_y = translated_y * self.zoom;
        
        let screen_x = scaled_x + self.viewport_w / 2.0;
        let screen_y = scaled_y + self.viewport_h / 2.0;
        
        (screen_x, screen_y)
    }

    /// Get visible world bounds
    pub fn get_visible_world_bounds(&self) -> (f32, f32, f32, f32) {
        let (min_x, min_y) = self.screen_to_world(0.0, 0.0);
        let (max_x, max_y) = self.screen_to_world(self.viewport_w, self.viewport_h);
        
        (min_x, min_y, max_x, max_y)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_screen_to_world_identity() {
        let camera = Camera::new();
        let (wx, wy) = camera.screen_to_world(400.0, 300.0);
        assert_eq!(wx, 0.0);
        assert_eq!(wy, 0.0);
    }

    #[test]
    fn test_world_to_screen_identity() {
        let camera = Camera::new();
        let (sx, sy) = camera.world_to_screen(0.0, 0.0);
        assert_eq!(sx, 400.0);
        assert_eq!(sy, 300.0);
    }

    #[test]
    fn test_roundtrip() {
        let mut camera = Camera::new();
        camera.set(2.0, 100.0, 50.0, 800.0, 600.0, 1.0);
        
        let (wx, wy) = camera.screen_to_world(400.0, 300.0);
        let (sx, sy) = camera.world_to_screen(wx, wy);
        
        assert!((sx - 400.0).abs() < 0.001);
        assert!((sy - 300.0).abs() < 0.001);
    }
}
