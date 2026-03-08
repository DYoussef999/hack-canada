import type { Node } from 'reactflow';

export type NodeCategory = 'Staff' | 'Overhead' | 'OpEx';

/** The four smart group buckets */
export type GroupCategory = 'revenue' | 'fixed' | 'variable' | 'labor';

export interface SourceNodeData {
  label: string;
  value: number;
  groupId?: string;
  isolated?: boolean;
  manualGroup?: boolean;
}

export interface ExpenseNodeData {
  label: string;
  value: number;
  category: NodeCategory;
  isDelta?: boolean;
  groupId?: string;
  isolated?: boolean;
  manualGroup?: boolean;
}

export interface GroupNodeData {
  label: string;
  groupCategory: GroupCategory;
  collapsed: boolean;
  /** Border / accent colour class applied to the header */
  colorClass: string;
}

export interface FinancialResult {
  revenue: number;
  totalExpenses: number;
  netProfit: number;
}

/** Data stored on every edge; used to distinguish general vs. direct-cost flows. */
export interface EdgeFlowData {
  edgeType: 'direct-cost' | 'general';
}

/** One segment = one revenue node/group plus its directly-linked expenses. */
export interface SegmentResult {
  id: string;
  label: string;
  revenue: number;
  directCosts: number;
  grossMargin: number;
  grossMarginPct: number;
  linkedExpenses: Array<{ label: string; value: number }>;
}

export interface ResultNodeData {
  onResultUpdate?: (result: FinancialResult) => void;
}

export type SourceFlowNode  = Node<SourceNodeData,  'source'>;
export type ExpenseFlowNode = Node<ExpenseNodeData, 'expense'>;
export type ResultFlowNode  = Node<ResultNodeData,  'result'>;
export type GroupFlowNode   = Node<GroupNodeData,   'group'>;

export type FinancialNode = SourceFlowNode | ExpenseFlowNode | ResultFlowNode;
export type AnyNodeData   = SourceNodeData | ExpenseNodeData | ResultNodeData | GroupNodeData;
