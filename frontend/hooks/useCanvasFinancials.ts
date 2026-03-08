import { useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import type {
  ExpenseNodeData,
  FinancialResult,
  NodeCategory,
  EdgeFlowData,
  SegmentResult,
} from '@/types/nodes';

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
  /** Per-revenue-segment gross margin, only populated when direct-cost edges exist. */
  segments: SegmentResult[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Sum the value of a node. For group nodes, sums all children. */
function resolveValue(nodeId: string, nodes: Node[]): number {
  const n = nodes.find((x) => x.id === nodeId);
  if (!n) return 0;
  if (n.type === 'group') {
    return nodes
      .filter((x) => x.parentNode === nodeId)
      .reduce((sum, child) => sum + ((child.data?.value as number) ?? 0), 0);
  }
  return (n.data?.value as number) ?? 0;
}

function resolveLabel(nodeId: string, nodes: Node[]): string {
  const n = nodes.find((x) => x.id === nodeId);
  return (n?.data?.label as string) ?? nodeId;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Computes the financial snapshot from ALL canvas nodes + edge linkage.
 *
 * - Counts every source/expense node regardless of group collapse state.
 * - Walks `direct-cost` edges to produce per-segment gross margin data
 *   (used by SummarySidebar Segment Profitability section and Backboard sync).
 *
 * @param nodes - Full React Flow nodes array from useNodesState
 * @param edges - Full React Flow edges array from useEdgesState
 */
export function useCanvasFinancials(nodes: Node[], edges: Edge[]): CanvasFinancials {
  return useMemo(() => {
    let revenue = 0;
    let totalExpenses = 0;
    const expenseBreakdown: ExpenseBreakdownItem[] = [];

    for (const node of nodes) {
      if (node.type === 'group') continue;
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

    // ── Segment profitability ──────────────────────────────────────────────────
    // Build: revenueNodeId → { label, revenue, expenses[] }
    const segmentMap = new Map<
      string,
      { label: string; revenue: number; expenses: Array<{ label: string; value: number }> }
    >();

    for (const edge of edges) {
      const edgeType = (edge.data as EdgeFlowData | undefined)?.edgeType;
      if (edgeType !== 'direct-cost') continue;
      if (!edge.source || !edge.target) continue;

      const tgtRevenue = resolveValue(edge.target, nodes);
      const tgtLabel   = resolveLabel(edge.target, nodes);
      const srcValue   = resolveValue(edge.source, nodes);
      const srcLabel   = resolveLabel(edge.source, nodes);

      if (!segmentMap.has(edge.target)) {
        segmentMap.set(edge.target, { label: tgtLabel, revenue: tgtRevenue, expenses: [] });
      }
      segmentMap.get(edge.target)!.expenses.push({ label: srcLabel, value: srcValue });
    }

    const segments: SegmentResult[] = Array.from(segmentMap.entries()).map(([id, seg]) => {
      const directCosts    = seg.expenses.reduce((s, e) => s + e.value, 0);
      const grossMargin    = seg.revenue - directCosts;
      const grossMarginPct = seg.revenue > 0 ? Math.round((grossMargin / seg.revenue) * 100) : 0;
      return {
        id,
        label: seg.label,
        revenue: seg.revenue,
        directCosts,
        grossMargin,
        grossMarginPct,
        linkedExpenses: seg.expenses,
      };
    });

    return {
      revenue,
      totalExpenses,
      netProfit: revenue - totalExpenses,
      expenseBreakdown,
      segments,
    };
  }, [nodes, edges]);
}
