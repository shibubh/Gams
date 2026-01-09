/**
 * CSS-like style model for design-team level styling.
 * All styles are serializable and versioned.
 * These properties are implemented in WebGL/Canvas2D, NOT DOM CSS.
 */

export const STYLE_MODEL_VERSION = '1.0.0';

// ============================================================================
// Box Model
// ============================================================================

export interface EdgeValues {
  t: number; // top
  r: number; // right
  b: number; // bottom
  l: number; // left
}

export interface CornerRadius {
  tl: number; // top-left
  tr: number; // top-right
  br: number; // bottom-right
  bl: number; // bottom-left
}

export interface BoxModel {
  /** Margin (spacing outside border) */
  margin: EdgeValues;
  /** Padding (spacing inside border) */
  padding: EdgeValues;
  /** Border width per edge */
  border: {
    width: EdgeValues;
    color: string;
    style: 'solid' | 'dashed' | 'dotted';
  };
  /** Border radius per corner */
  radius: CornerRadius;
}

// ============================================================================
// Background
// ============================================================================

export type GradientType = 'linear' | 'radial' | 'conic';

export interface GradientStop {
  color: string;
  position: number; // 0-1
}

export interface LinearGradient {
  type: 'linear';
  angle: number; // degrees
  stops: GradientStop[];
}

export interface RadialGradient {
  type: 'radial';
  stops: GradientStop[];
}

export interface ConicGradient {
  type: 'conic';
  angle: number; // degrees
  stops: GradientStop[];
}

export type Gradient = LinearGradient | RadialGradient | ConicGradient;

export interface BackgroundImage {
  url: string;
  fit: 'cover' | 'contain' | 'fill' | 'none';
  position: { x: number; y: number }; // 0-1
  repeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
}

export interface Background {
  color?: string;
  gradient?: Gradient; // optional for now
  image?: BackgroundImage; // optional placeholder
}

// ============================================================================
// Shadow
// ============================================================================

export interface BoxShadow {
  x: number; // offset X
  y: number; // offset Y
  blur: number;
  spread: number;
  color: string;
  inset?: boolean;
}

// ============================================================================
// Blend Modes
// ============================================================================

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

// ============================================================================
// Extended Text Style
// ============================================================================

export interface ExtendedTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | 'normal' | 'bold' | 'lighter' | 'bolder';
  fontStyle: 'normal' | 'italic' | 'oblique';
  lineHeight: number; // multiplier
  letterSpacing: number; // px
  textAlign: 'left' | 'center' | 'right' | 'justify';
  textDecoration: 'none' | 'underline' | 'line-through' | 'overline';
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  color: string;
  // Shadow for text (different from box shadow)
  textShadow?: Array<{
    x: number;
    y: number;
    blur: number;
    color: string;
  }>;
}

// ============================================================================
// Complete Style Model
// ============================================================================

export interface NodeStyleExtended {
  // Version for future migration
  version: string;

  // Box model
  boxModel?: BoxModel;

  // Background
  background?: Background;

  // Shadows (multiple shadows supported)
  shadows?: BoxShadow[];

  // Opacity
  opacity: number; // 0-1

  // Stroke/outline
  stroke?: {
    color: string;
    width: number;
    opacity: number;
    dashArray?: number[];
    dashOffset?: number;
  };

  // Clipping
  overflow: 'visible' | 'hidden';

  // Blend mode (optional placeholder)
  blendMode?: BlendMode;

  // Visibility and interaction
  visible: boolean;
  locked: boolean;

  // Text-specific styles (only for text nodes)
  textStyle?: ExtendedTextStyle;
}

// ============================================================================
// Style Defaults
// ============================================================================

export function createDefaultEdgeValues(value: number = 0): EdgeValues {
  return { t: value, r: value, b: value, l: value };
}

export function createDefaultCornerRadius(value: number = 0): CornerRadius {
  return { tl: value, tr: value, br: value, bl: value };
}

export function createDefaultBoxModel(): BoxModel {
  return {
    margin: createDefaultEdgeValues(0),
    padding: createDefaultEdgeValues(0),
    border: {
      width: createDefaultEdgeValues(0),
      color: '#000000',
      style: 'solid',
    },
    radius: createDefaultCornerRadius(0),
  };
}

export function createDefaultNodeStyle(): NodeStyleExtended {
  return {
    version: STYLE_MODEL_VERSION,
    opacity: 1,
    overflow: 'visible',
    visible: true,
    locked: false,
  };
}

// ============================================================================
// Style Serialization
// ============================================================================

export interface SerializedStyle {
  version: string;
  data: NodeStyleExtended;
}

export function serializeStyle(style: NodeStyleExtended): SerializedStyle {
  return {
    version: STYLE_MODEL_VERSION,
    data: style,
  };
}

export function deserializeStyle(serialized: SerializedStyle): NodeStyleExtended {
  // Future: handle version migrations here
  if (serialized.version !== STYLE_MODEL_VERSION) {
    console.warn(`Style version mismatch: ${serialized.version} vs ${STYLE_MODEL_VERSION}`);
    // Apply migrations as needed
  }
  return serialized.data;
}

// ============================================================================
// Style Bounds Calculations
// ============================================================================

/**
 * Calculate the expanded bounds including margin and border.
 * Used for hit-testing and layout.
 */
export function calculateExpandedBounds(
  baseBounds: { x: number; y: number; width: number; height: number },
  style?: NodeStyleExtended
): { x: number; y: number; width: number; height: number } {
  if (!style?.boxModel) {
    return baseBounds;
  }

  const { margin, border } = style.boxModel;
  const totalLeft = margin.l + border.width.l;
  const totalRight = margin.r + border.width.r;
  const totalTop = margin.t + border.width.t;
  const totalBottom = margin.b + border.width.b;

  return {
    x: baseBounds.x - totalLeft,
    y: baseBounds.y - totalTop,
    width: baseBounds.width + totalLeft + totalRight,
    height: baseBounds.height + totalTop + totalBottom,
  };
}

/**
 * Calculate the content bounds (excluding padding and border).
 */
export function calculateContentBounds(
  baseBounds: { x: number; y: number; width: number; height: number },
  style?: NodeStyleExtended
): { x: number; y: number; width: number; height: number } {
  if (!style?.boxModel) {
    return baseBounds;
  }

  const { padding, border } = style.boxModel;
  const totalLeft = padding.l + border.width.l;
  const totalRight = padding.r + border.width.r;
  const totalTop = padding.t + border.width.t;
  const totalBottom = padding.b + border.width.b;

  return {
    x: baseBounds.x + totalLeft,
    y: baseBounds.y + totalTop,
    width: Math.max(0, baseBounds.width - totalLeft - totalRight),
    height: Math.max(0, baseBounds.height - totalTop - totalBottom),
  };
}

/**
 * Check if a point is inside a rounded rectangle.
 * Used for hit-testing with border radius.
 */
export function isPointInRoundedRect(
  px: number,
  py: number,
  bounds: { x: number; y: number; width: number; height: number },
  radius: CornerRadius
): boolean {
  const { x, y, width, height } = bounds;
  const { tl, tr, br, bl } = radius;

  // Quick reject if outside bounding box
  if (px < x || px > x + width || py < y || py > y + height) {
    return false;
  }

  // Check each corner
  const checkCorner = (
    cornerX: number,
    cornerY: number,
    cornerRadius: number
  ): boolean => {
    if (cornerRadius === 0) return true;
    const dx = px - cornerX;
    const dy = py - cornerY;
    return dx * dx + dy * dy <= cornerRadius * cornerRadius;
  };

  // Top-left corner
  if (px < x + tl && py < y + tl) {
    return checkCorner(x + tl, y + tl, tl);
  }

  // Top-right corner
  if (px > x + width - tr && py < y + tr) {
    return checkCorner(x + width - tr, y + tr, tr);
  }

  // Bottom-right corner
  if (px > x + width - br && py > y + height - br) {
    return checkCorner(x + width - br, y + height - br, br);
  }

  // Bottom-left corner
  if (px < x + bl && py > y + height - bl) {
    return checkCorner(x + bl, y + height - bl, bl);
  }

  // Point is in the rectangle but not in corner radius zones
  return true;
}
