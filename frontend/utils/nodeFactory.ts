import type { SourceFlowNode, ExpenseFlowNode, ResultFlowNode, NodeCategory } from '@/types/nodes';

/** Stable unique ID using timestamp + increment — safe across HMR reloads */
let _counter = 0;
function nextId(): string {
  return `node-${Date.now()}-${++_counter}`;
}

/** Default canvas position for the singleton ResultNode */
export const RESULT_NODE_ID = 'result-1';

/**
 * Creates a new SourceNode (revenue stream) at the given canvas position.
 * Supports an optional groupId for future AI-generated cluster groupings.
 */
export function createSourceNode(
  position: { x: number; y: number },
  groupId?: string
): SourceFlowNode {
  return {
    id: nextId(),
    type: 'source',
    position,
    data: {
      label: 'Monthly Sales',
      value: 0,
      groupId,
    },
  };
}

/**
 * Creates a new ExpenseNode (cost category) at the given canvas position.
 * Supports an optional groupId for future AI-generated cluster groupings.
 */
export function createExpenseNode(
  position: { x: number; y: number },
  groupId?: string
): ExpenseFlowNode {
  return {
    id: nextId(),
    type: 'expense',
    position,
    data: {
      label: 'New Expense',
      value: 0,
      category: 'OpEx' as NodeCategory,
      groupId,
    },
  };
}

/**
 * Creates the singleton ResultNode. Only one should exist per canvas.
 * Uses a fixed ID so edges can target it predictably.
 */
export function createResultNode(position: { x: number; y: number }): ResultFlowNode {
  return {
    id: RESULT_NODE_ID,
    type: 'result',
    position,
    data: {},
  };
}
