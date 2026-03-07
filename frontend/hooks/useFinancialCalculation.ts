import { useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import type { FinancialResult } from '@/types/nodes';

/**
 * Computes Net Profit by traversing edges that flow into a given ResultNode.
 *
 * - SourceNodes connected to the ResultNode are summed as revenue (additive)
 * - ExpenseNodes connected to the ResultNode are summed as costs (subtractive)
 * - Calculation is memoized — only recomputes when nodes or edges change
 *
 * TODO (What-If mode): When an ExpenseNode has `isDelta: true`, treat its value
 * as a percentage modifier on total revenue instead of an absolute subtraction.
 * This enables scenario nodes like "Minimum Wage Increase +$2/hr".
 *
 * @param nodes - All nodes in the current React Flow graph
 * @param edges - All edges in the current React Flow graph
 * @param resultNodeId - The ID of the ResultNode to compute for
 */
export function useFinancialCalculation(
  nodes: Node[],
  edges: Edge[],
  resultNodeId: string
): FinancialResult {
  return useMemo(() => {
    // Collect IDs of all nodes whose output feeds directly into this ResultNode
    const connectedSourceIds = new Set(
      edges.filter((e) => e.target === resultNodeId).map((e) => e.source)
    );

    let revenue = 0;
    let totalExpenses = 0;

    for (const node of nodes) {
      if (!connectedSourceIds.has(node.id)) continue;

      if (node.type === 'source') {
        revenue += (node.data?.value as number) ?? 0;
      } else if (node.type === 'expense') {
        totalExpenses += (node.data?.value as number) ?? 0;
      }
    }

    return {
      revenue,
      totalExpenses,
      netProfit: revenue - totalExpenses,
    };
  }, [nodes, edges, resultNodeId]);
}
