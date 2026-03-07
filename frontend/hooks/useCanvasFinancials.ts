import { useMemo } from 'react';
import type { Node } from 'reactflow';
import type { ExpenseNodeData, FinancialResult, NodeCategory } from '@/types/nodes';

/** A single row in the cost breakdown list shown in the right sidebar. */
export interface ExpenseBreakdownItem {
  id: string;
  label: string;
  value: number;
  category: NodeCategory;
}

/** Full financial snapshot derived from canvas node state. */
export interface CanvasFinancials extends FinancialResult {
  expenseBreakdown: ExpenseBreakdownItem[];
}

/**
 * Computes the financial snapshot from ALL nodes currently on the canvas.
 * Unlike `useFinancialCalculation`, this does NOT require edges or a ResultNode —
 * every Source/Expense node on canvas is counted immediately, giving the SMB
 * owner instant feedback as they build their model.
 *
 * TODO (What-If mode): filter by `isDelta` flag and apply delta logic here.
 *
 * @param nodes - The full React Flow nodes array from useNodesState
 */
export function useCanvasFinancials(nodes: Node[]): CanvasFinancials {
  return useMemo(() => {
    let revenue = 0;
    let totalExpenses = 0;
    const expenseBreakdown: ExpenseBreakdownItem[] = [];

    for (const node of nodes) {
      if (node.type === 'source') {
        revenue += (node.data?.value as number) ?? 0;
      } else if (node.type === 'expense') {
        const value = (node.data?.value as number) ?? 0;
        totalExpenses += value;
        expenseBreakdown.push({
          id: node.id,
          label: (node.data?.label as string) ?? 'Expense',
          value,
          category: (node.data as ExpenseNodeData).category ?? 'OpEx',
        });
      }
    }

    return {
      revenue,
      totalExpenses,
      netProfit: revenue - totalExpenses,
      expenseBreakdown,
    };
  }, [nodes]);
}
