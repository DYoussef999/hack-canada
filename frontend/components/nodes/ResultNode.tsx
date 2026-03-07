'use client';

import { useEffect, useRef } from 'react';
import { Handle, Position, useNodes, useEdges } from 'reactflow';
import { BarChart2 } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import type { ResultNodeData } from '@/types/nodes';
import { useFinancialCalculation } from '@/hooks/useFinancialCalculation';

const formatCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(v);

/**
 * ResultNode — displays the bottom line: Net Profit.
 *
 * Reactively subscribes to the full graph via useNodes() + useEdges(),
 * then delegates calculation to useFinancialCalculation (memoized).
 * No setNodes call needed — this node derives its display from graph state.
 *
 * Exposes computed values via data.onResultUpdate for external consumers
 * (e.g., ElevenLabs Voice Guide reads results aloud in plain English).
 */
export default function ResultNode({ id, data }: NodeProps<ResultNodeData>) {
  const nodes = useNodes();
  const edges = useEdges();
  const { revenue, totalExpenses, netProfit } = useFinancialCalculation(nodes, edges, id);

  // Stable ref so the callback side-effect doesn't re-subscribe on every render
  const onResultUpdateRef = useRef(data.onResultUpdate);
  useEffect(() => { onResultUpdateRef.current = data.onResultUpdate; });

  useEffect(() => {
    onResultUpdateRef.current?.({ revenue, totalExpenses, netProfit });
  }, [revenue, totalExpenses, netProfit]);

  const isProfit = netProfit >= 0;

  return (
    <div className="rounded-xl border-2 border-yellow-400 bg-yellow-950 p-5 min-w-[250px] shadow-xl">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-yellow-400 !border-2 !border-yellow-700"
      />

      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-5 h-5 text-yellow-400" />
        <span className="text-xs font-bold text-yellow-300 uppercase tracking-widest">
          Net Profit
        </span>
      </div>

      <div className={`text-4xl font-extrabold mb-1 tabular-nums ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
        {formatCAD(netProfit)}
      </div>
      <p className="text-xs text-yellow-700 mb-4">Revenue − Total Costs</p>

      <div className="border-t border-yellow-900 pt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Revenue</span>
          <span className="text-green-400 tabular-nums">{formatCAD(revenue)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Expenses</span>
          <span className="text-red-400 tabular-nums">{formatCAD(totalExpenses)}</span>
        </div>
      </div>
    </div>
  );
}
