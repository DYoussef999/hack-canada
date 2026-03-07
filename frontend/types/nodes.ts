import type { Node } from 'reactflow';

export type NodeCategory = 'Staff' | 'Overhead' | 'OpEx';

export interface SourceNodeData {
  label: string;
  value: number;
  /** Future: cluster ID for AI-generated node groupings (CSV/Sheets import) */
  groupId?: string;
}

export interface ExpenseNodeData {
  label: string;
  value: number;
  category: NodeCategory;
  /**
   * Future (What-If mode): when true, value is a delta modifier applied to
   * connected revenue rather than an absolute cost.
   * TODO: implement delta mode in useFinancialCalculation
   */
  isDelta?: boolean;
  groupId?: string;
}

export interface FinancialResult {
  revenue: number;
  totalExpenses: number;
  netProfit: number;
}

export interface ResultNodeData {
  /**
   * Optional callback for external consumers.
   * Used by the ElevenLabs Voice Guide to read results aloud.
   */
  onResultUpdate?: (result: FinancialResult) => void;
}

export type SourceFlowNode = Node<SourceNodeData, 'source'>;
export type ExpenseFlowNode = Node<ExpenseNodeData, 'expense'>;
export type ResultFlowNode = Node<ResultNodeData, 'result'>;

/** Union of all financial node types used in the graph */
export type FinancialNode = SourceFlowNode | ExpenseFlowNode | ResultFlowNode;

/**
 * Common node data union — used to type useNodesState so the canvas can
 * hold a mixed array of Source, Expense, and Result nodes without type errors.
 */
export type AnyNodeData = SourceNodeData | ExpenseNodeData | ResultNodeData;
