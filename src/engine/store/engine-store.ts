/**
 * Engine Store - Central state management
 * Uses Zustand for efficient subscription and updates
 */

import { create } from "zustand";
import type { DocumentModel, EngineStore as IEngineStore, Command } from "../core/types";
import { createRootNode } from "../core/node-utils";

interface StoreState {
  document: DocumentModel;
  history: {
    past: Command[];
    future: Command[];
  };
  setDocument: (doc: DocumentModel) => void;
  executeCommand: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  updateSelection: (selection: string[]) => void;
}

const createEmptyDocument = (): DocumentModel => {
  const root = createRootNode();
  return {
    schemaVersion: 1,
    rootId: root.id,
    nodes: {
      [root.id]: root,
    },
    selection: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
};

const useStore = create<StoreState>((set, get) => ({
  document: createEmptyDocument(),
  history: {
    past: [],
    future: [],
  },

  setDocument: (doc) => {
    set({
      document: {
        ...doc,
        metadata: {
          ...doc.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  },

  executeCommand: (cmd) => {
    const { document, history } = get();
    const newDoc = cmd.do(document);
    
    set({
      document: {
        ...newDoc,
        metadata: {
          ...newDoc.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
      history: {
        past: [...history.past, cmd],
        future: [],
      },
    });
  },

  undo: () => {
    const { document, history } = get();
    const { past } = history;
    
    if (past.length === 0) return;
    
    const cmd = past[past.length - 1];
    const newDoc = cmd.undo(document);
    
    set({
      document: {
        ...newDoc,
        metadata: {
          ...newDoc.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
      history: {
        past: past.slice(0, -1),
        future: [cmd, ...history.future],
      },
    });
  },

  redo: () => {
    const { document, history } = get();
    const { future } = history;
    
    if (future.length === 0) return;
    
    const cmd = future[0];
    const newDoc = cmd.do(document);
    
    set({
      document: {
        ...newDoc,
        metadata: {
          ...newDoc.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
      history: {
        past: [...history.past, cmd],
        future: future.slice(1),
      },
    });
  },

  updateSelection: (selection) => {
    set((state) => ({
      document: {
        ...state.document,
        selection,
        metadata: {
          ...state.document.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  },
}));

/**
 * Create an EngineStore implementation
 */
export function createEngineStore(): IEngineStore {
  return {
    get: () => useStore.getState().document,
    
    subscribe: (selector, cb) => {
      let previousValue = selector(useStore.getState().document);
      
      return useStore.subscribe((state) => {
        const newValue = selector(state.document);
        if (newValue !== previousValue) {
          previousValue = newValue;
          cb(newValue);
        }
      });
    },
    
    dispatch: (action: any) => {
      const state = useStore.getState();
      
      if (action.type === "EXECUTE_COMMAND") {
        state.executeCommand(action.command);
      } else if (action.type === "UNDO") {
        state.undo();
      } else if (action.type === "REDO") {
        state.redo();
      } else if (action.type === "SET_DOCUMENT") {
        state.setDocument(action.document);
      } else if (action.type === "UPDATE_SELECTION") {
        state.updateSelection(action.selection);
      }
    },
  };
}

// Export hook for React components
export { useStore };
