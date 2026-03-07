'use client';

import { useCallback } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { TrendingUp } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import type { SourceNodeData } from '@/types/nodes';

/** Formats a number as Canadian dollars, no decimals */
const formatCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(v);

/**
 * SourceNode — represents a revenue stream or cash inflow.
 * (e.g. Monthly Sales, Grant Income, Subscription Revenue)
 *
 * Exposes one output Handle on the right. Connect to ResultNode to
 * contribute to gross revenue in the Net Profit calculation.
 */
export default function SourceNode({ id, data }: NodeProps<SourceNodeData>) {
  const { setNodes } = useReactFlow();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value) || 0;
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, value } } : n))
      );
    },
    [id, setNodes]
  );

  return (
    <div className="rounded-xl border-2 border-green-500 bg-green-950 p-4 min-w-[200px] shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-sm font-semibold text-green-200 truncate">{data.label}</span>
      </div>

      <input
        type="number"
        value={data.value}
        onChange={handleChange}
        className="w-full bg-green-900 border border-green-700 rounded-lg px-3 py-2 text-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 nodrag"
        placeholder="0"
        min={0}
      />
      <p className="text-xs text-green-600 mt-1.5">{formatCAD(data.value)} / mo</p>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-400 !border-2 !border-green-700"
      />
    </div>
  );
}
