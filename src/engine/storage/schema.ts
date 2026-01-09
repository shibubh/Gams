/**
 * Schema validation using Zod
 */

import { z } from "zod";

export const Vec2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

export const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const Mat3Schema = z.instanceof(Float32Array).refine((arr) => arr.length === 9);

export const SceneNodeBaseSchema = z.object({
  id: z.string(),
  type: z.enum(["frame", "rect", "ellipse", "line", "text", "group"]),
  parentId: z.string().nullable(),
  childIds: z.array(z.string()),
  localTransform: Mat3Schema,
  worldTransformVersion: z.number(),
  localBounds: RectSchema,
  worldBounds: RectSchema,
  style: z.record(z.string(), z.any()),
  name: z.string().optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

export const SceneNodeSchema = z.union([
  SceneNodeBaseSchema.extend({
    type: z.literal("rect"),
    style: z.object({
      fill: z.string().optional(),
      stroke: z.string().optional(),
      strokeWidth: z.number().optional(),
      radius: z.number().optional(),
    }),
  }),
  SceneNodeBaseSchema.extend({
    type: z.literal("ellipse"),
    style: z.object({
      fill: z.string().optional(),
      stroke: z.string().optional(),
      strokeWidth: z.number().optional(),
    }),
  }),
  SceneNodeBaseSchema.extend({
    type: z.literal("line"),
    style: z.object({
      stroke: z.string().optional(),
      strokeWidth: z.number().optional(),
    }),
  }),
  SceneNodeBaseSchema.extend({
    type: z.literal("text"),
    style: z.object({
      text: z.string(),
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      fontWeight: z.number().optional(),
      align: z.enum(["left", "center", "right"]).optional(),
      color: z.string().optional(),
    }),
  }),
  SceneNodeBaseSchema.extend({
    type: z.literal("frame"),
    style: z.object({
      fill: z.string().optional(),
    }),
  }),
  SceneNodeBaseSchema.extend({
    type: z.literal("group"),
    style: z.object({}),
  }),
]);

export const DocumentModelSchema = z.object({
  schemaVersion: z.number(),
  rootId: z.string(),
  nodes: z.record(z.string(), SceneNodeSchema),
  selection: z.array(z.string()),
  metadata: z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

export type DocumentModelSerialized = z.infer<typeof DocumentModelSchema>;

/**
 * Serialize Mat3 arrays for JSON
 */
export function serializeDocument(doc: any): DocumentModelSerialized {
  const serialized = {
    ...doc,
    nodes: {} as any,
  };

  for (const id in doc.nodes) {
    const node = doc.nodes[id];
    serialized.nodes[id] = {
      ...node,
      localTransform: Array.from(node.localTransform),
    };
  }

  return serialized;
}

/**
 * Deserialize Mat3 arrays from JSON
 */
export function deserializeDocument(data: any): any {
  const deserialized = {
    ...data,
    nodes: {} as any,
  };

  for (const id in data.nodes) {
    const node = data.nodes[id];
    deserialized.nodes[id] = {
      ...node,
      localTransform: new Float32Array(node.localTransform),
    };
  }

  return deserialized;
}
