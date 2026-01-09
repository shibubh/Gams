/**
 * Performance Debug Overlay
 * 
 * Displays real-time performance metrics:
 * - FPS
 * - Frame time
 * - Visible node count
 * - Hit-test timing
 * - Culling timing
 * - WASM node count
 */

import React, { useState, useEffect } from 'react';
import './PerformanceOverlay.css';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  visibleCount: number;
  totalCount: number;
  cullTime: number;
  hitTestTime: number;
  wasmNodeCount: number;
}

interface PerformanceOverlayProps {
  visible?: boolean;
}

export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({ 
  visible = false 
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    visibleCount: 0,
    totalCount: 0,
    cullTime: 0,
    hitTestTime: 0,
    wasmNodeCount: 0,
  });

  useEffect(() => {
    if (!visible) return;

    // Listen for performance updates from the engine
    const handlePerfUpdate = (event: CustomEvent<PerformanceMetrics>) => {
      setMetrics(event.detail);
    };

    window.addEventListener('perf-update', handlePerfUpdate as EventListener);

    return () => {
      window.removeEventListener('perf-update', handlePerfUpdate as EventListener);
    };
  }, [visible]);

  if (!visible) return null;

  const getColorForFPS = (fps: number): string => {
    if (fps >= 58) return '#4ade80'; // green
    if (fps >= 45) return '#fbbf24'; // yellow
    return '#f87171'; // red
  };

  const getColorForTime = (ms: number, threshold: number): string => {
    if (ms < threshold) return '#4ade80';
    if (ms < threshold * 1.5) return '#fbbf24';
    return '#f87171';
  };

  return (
    <div className="performance-overlay">
      <div className="perf-title">Performance</div>
      
      <div className="perf-row">
        <span className="perf-label">FPS:</span>
        <span 
          className="perf-value" 
          style={{ color: getColorForFPS(metrics.fps) }}
        >
          {metrics.fps.toFixed(1)}
        </span>
      </div>

      <div className="perf-row">
        <span className="perf-label">Frame:</span>
        <span 
          className="perf-value"
          style={{ color: getColorForTime(metrics.frameTime, 16.67) }}
        >
          {metrics.frameTime.toFixed(2)}ms
        </span>
      </div>

      <div className="perf-row">
        <span className="perf-label">Visible:</span>
        <span className="perf-value">
          {metrics.visibleCount} / {metrics.totalCount}
        </span>
      </div>

      <div className="perf-row">
        <span className="perf-label">Cull:</span>
        <span 
          className="perf-value"
          style={{ color: getColorForTime(metrics.cullTime, 2) }}
        >
          {metrics.cullTime.toFixed(2)}ms
        </span>
      </div>

      <div className="perf-row">
        <span className="perf-label">Hit-test:</span>
        <span 
          className="perf-value"
          style={{ color: getColorForTime(metrics.hitTestTime, 2) }}
        >
          {metrics.hitTestTime.toFixed(2)}ms
        </span>
      </div>

      <div className="perf-row">
        <span className="perf-label">WASM:</span>
        <span className="perf-value">
          {metrics.wasmNodeCount} nodes
        </span>
      </div>
    </div>
  );
};

/**
 * Helper to dispatch performance metrics
 */
export function updatePerformanceMetrics(metrics: Partial<PerformanceMetrics>): void {
  const event = new CustomEvent('perf-update', {
    detail: metrics,
  });
  window.dispatchEvent(event);
}
