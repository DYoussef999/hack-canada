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
      className={`rounded-lg border border-t-2 p-3 min-w-[180px] shadow-sm`}
      style={{
        background: '#ffffff',
        borderColor: 'var(--forest-rim)',
        borderTopColor: data.isolated ? '#eab308' : '#16a34a',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp
          className={`w-3 h-3 shrink-0 ${data.isolated ? 'text-yellow-500' : 'text-emerald-600'}`}
          strokeWidth={1.5}
        />
        <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--forest)' }}>{data.label}</span>
        {data.isolated && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-600 font-bold shrink-0">
            WHAT-IF
          </span>
        )}
      </div>

      <input
        type="number"
        value={data.value}
        onChange={handleChange}
        className="w-full rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 nodrag"
        style={{
          background: 'var(--forest-mid)',
          border: '1px solid var(--forest-rim)',
          color: 'var(--forest)',
        }}
        placeholder="0"
        min={0}
      />
      <p className="text-[10px] text-emerald-700 mt-1">{formatCAD(data.value)} / mo</p>

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
