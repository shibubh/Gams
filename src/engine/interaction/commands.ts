/**
 * Command implementations for undo/redo
 */

import type { Command, DocumentModel, ID, SceneNode, Vec2 } from "../core/types";
import { cloneNode } from "../core/node-utils";

/**
 * Set selection command
 */
export class SetSelectionCommand implements Command {
  id: string;
  name: string;
  private previousSelection: ID[];
  private newSelection: ID[];

  constructor(selection: ID[], previousSelection: ID[]) {
    this.id = `set-selection-${Date.now()}`;
    this.name = "Set Selection";
    this.previousSelection = previousSelection;
    this.newSelection = selection;
  }

  do(doc: DocumentModel): DocumentModel {
    return {
      ...doc,
      selection: this.newSelection,
    };
  }

  undo(doc: DocumentModel): DocumentModel {
    return {
      ...doc,
      selection: this.previousSelection,
    };
  }

  merge(_next: Command): Command | null {
    // Don't merge selection commands
    return null;
  }
}

/**
 * Create node command
 */
export class CreateNodeCommand implements Command {
  id: string;
  name: string;
  private node: SceneNode;

  constructor(node: SceneNode) {
    this.id = `create-node-${Date.now()}`;
    this.name = `Create ${node.type}`;
    this.node = node;
  }

  do(doc: DocumentModel): DocumentModel {
    return {
      ...doc,
      nodes: {
        ...doc.nodes,
        [this.node.id]: this.node,
      },
      selection: [this.node.id],
    };
  }

  undo(doc: DocumentModel): DocumentModel {
    const nodes = { ...doc.nodes };
    delete nodes[this.node.id];

    return {
      ...doc,
      nodes,
      selection: [],
    };
  }

  merge(_next: Command): Command | null {
    return null;
  }
}

/**
 * Delete nodes command
 */
export class DeleteNodesCommand implements Command {
  id: string;
  name: string;
  private nodeIds: ID[];
  private deletedNodes: Record<ID, SceneNode>;

  constructor(nodeIds: ID[], nodes: Record<ID, SceneNode>) {
    this.id = `delete-nodes-${Date.now()}`;
    this.name = `Delete ${nodeIds.length} node(s)`;
    this.nodeIds = nodeIds;
    this.deletedNodes = {};

    for (const id of nodeIds) {
      if (nodes[id]) {
        this.deletedNodes[id] = cloneNode(nodes[id]);
      }
    }
  }

  do(doc: DocumentModel): DocumentModel {
    const nodes = { ...doc.nodes };

    for (const id of this.nodeIds) {
      delete nodes[id];
    }

    return {
      ...doc,
      nodes,
      selection: [],
    };
  }

  undo(doc: DocumentModel): DocumentModel {
    return {
      ...doc,
      nodes: {
        ...doc.nodes,
        ...this.deletedNodes,
      },
      selection: this.nodeIds,
    };
  }

  merge(_next: Command): Command | null {
    return null;
  }
}

/**
 * Translate nodes command
 */
export class TranslateNodesCommand implements Command {
  id: string;
  name: string;
  private nodeIds: ID[];
  private delta: Vec2;
  private timestamp: number;

  constructor(nodeIds: ID[], delta: Vec2) {
    this.id = `translate-nodes-${Date.now()}`;
    this.name = `Move ${nodeIds.length} node(s)`;
    this.nodeIds = nodeIds;
    this.delta = delta;
    this.timestamp = Date.now();
  }

  do(doc: DocumentModel): DocumentModel {
    const nodes = { ...doc.nodes };

    for (const id of this.nodeIds) {
      const node = nodes[id];
      if (!node) continue;

      const updatedNode = cloneNode(node);
      updatedNode.localBounds = {
        ...node.localBounds,
        x: node.localBounds.x + this.delta.x,
        y: node.localBounds.y + this.delta.y,
      };
      updatedNode.worldBounds = {
        ...node.worldBounds,
        x: node.worldBounds.x + this.delta.x,
        y: node.worldBounds.y + this.delta.y,
      };
      updatedNode.worldTransformVersion += 1;

      nodes[id] = updatedNode;
    }

    return {
      ...doc,
      nodes,
    };
  }

  undo(doc: DocumentModel): DocumentModel {
    const nodes = { ...doc.nodes };

    for (const id of this.nodeIds) {
      const node = nodes[id];
      if (!node) continue;

      const updatedNode = cloneNode(node);
      updatedNode.localBounds = {
        ...node.localBounds,
        x: node.localBounds.x - this.delta.x,
        y: node.localBounds.y - this.delta.y,
      };
      updatedNode.worldBounds = {
        ...node.worldBounds,
        x: node.worldBounds.x - this.delta.x,
        y: node.worldBounds.y - this.delta.y,
      };
      updatedNode.worldTransformVersion += 1;

      nodes[id] = updatedNode;
    }

    return {
      ...doc,
      nodes,
    };
  }

  merge(next: Command): Command | null {
    if (!(next instanceof TranslateNodesCommand)) return null;
    
    // Merge if same nodes and within 500ms
    if (
      this.nodeIds.length === next.nodeIds.length &&
      this.nodeIds.every((id, i) => id === next.nodeIds[i]) &&
      next.timestamp - this.timestamp < 500
    ) {
      return new TranslateNodesCommand(this.nodeIds, {
        x: this.delta.x + next.delta.x,
        y: this.delta.y + next.delta.y,
      });
    }

    return null;
  }
}

/**
 * Update node style command
 */
export class UpdateNodeStyleCommand implements Command {
  id: string;
  name: string;
  private nodeId: ID;
  private previousStyle: Record<string, any>;
  private newStyle: Record<string, any>;

  constructor(nodeId: ID, previousStyle: Record<string, any>, newStyle: Record<string, any>) {
    this.id = `update-style-${Date.now()}`;
    this.name = "Update Style";
    this.nodeId = nodeId;
    this.previousStyle = previousStyle;
    this.newStyle = newStyle;
  }

  do(doc: DocumentModel): DocumentModel {
    const node = doc.nodes[this.nodeId];
    if (!node) return doc;

    const updatedNode = cloneNode(node);
    updatedNode.style = { ...this.newStyle };

    return {
      ...doc,
      nodes: {
        ...doc.nodes,
        [this.nodeId]: updatedNode,
      },
    };
  }

  undo(doc: DocumentModel): DocumentModel {
    const node = doc.nodes[this.nodeId];
    if (!node) return doc;

    const updatedNode = cloneNode(node);
    updatedNode.style = { ...this.previousStyle };

    return {
      ...doc,
      nodes: {
        ...doc.nodes,
        [this.nodeId]: updatedNode,
      },
    };
  }

  merge(_next: Command): Command | null {
    return null;
  }
}
