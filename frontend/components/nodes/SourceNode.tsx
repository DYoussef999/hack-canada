'use client';

import { useCallback } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { TrendingUp } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import type { SourceNodeData } from '@/types/nodes';

const formatCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(v);

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
    <div
      className={`rounded-lg border border-slate-800 border-t-2 ${
        data.isolated ? 'border-t-yellow-500' : 'border-t-emerald-500'
      } bg-slate-900 p-3 min-w-[180px] shadow-md`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp
          className={`w-3 h-3 shrink-0 ${data.isolated ? 'text-yellow-400' : 'text-emerald-400'}`}
          strokeWidth={1.5}
        />
        <span className="text-xs font-semibold text-slate-200 truncate flex-1">{data.label}</span>
        {data.isolated && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 font-bold shrink-0">
            WHAT-IF
          </span>
        )}
      </div>

      <input
        type="number"
        value={data.value}
        onChange={handleChange}
        className="w-full bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 nodrag"
        placeholder="0"
        min={0}
      />
      <p className="text-[10px] text-emerald-600/80 mt-1">{formatCAD(data.value)} / mo</p>

      {/* Only expose handle when standalone or in What-If mode — group handle is used otherwise */}
      {(!data.groupId || data.isolated) && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-emerald-500 !border !border-emerald-700"
        />
      )}
    </div>
  );
}
