import type { SourceFlowNode, ExpenseFlowNode, ResultFlowNode, GroupFlowNode, NodeCategory, GroupCategory, GroupNodeData } from '@/types/nodes';
import { GROUP_W, GROUP_HEADER_H, BUCKET_CONFIG, expandedGroupH } from '@/utils/groupLayout';

let _counter = 0;
function nextId(): string {
  return `node-${Date.now()}-${++_counter}`;
}

export const RESULT_NODE_ID = 'result-1';

export function createSourceNode(
  position: { x: number; y: number },
  groupId?: string
): SourceFlowNode {
  return {
    id: nextId(),
    type: 'source',
    position,
    data: { label: 'New Revenue', value: 0, groupId },
  };
}

export function createExpenseNode(
  position: { x: number; y: number },
  groupId?: string,
  category?: NodeCategory
): ExpenseFlowNode {
  return {
    id: nextId(),
    type: 'expense',
    position,
    data: { label: 'New Expense', value: 0, category: category ?? 'Inventory & Suppliers' as NodeCategory, groupId },
  };
}

export function createResultNode(position: { x: number; y: number }): ResultFlowNode {
  return {
    id: RESULT_NODE_ID,
    type: 'result',
    position,
    data: {},
  };
}

export function createGroupNode(
  category: GroupCategory,
  position: { x: number; y: number },
  childCount = 0
): GroupFlowNode {
  const cfg = BUCKET_CONFIG[category];
  return {
    id:       `group-${category}`,
    type:     'group',
    position,
    style:    { width: GROUP_W, height: expandedGroupH(childCount) },
    data: {
      label:         cfg.label,
      groupCategory: category,
      collapsed:     false,
      colorClass:    cfg.colorClass,
    } as GroupNodeData,
    selectable: true,
    draggable:  true,
  };
}
