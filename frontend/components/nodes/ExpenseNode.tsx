'use client';

import { useCallback } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { ArrowDownCircle } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import type { ExpenseNodeData, NodeCategory } from '@/types/nodes';

const CATEGORIES: NodeCategory[] = ['Staff', 'Overhead', 'OpEx'];

const CATEGORY_STYLE: Record<NodeCategory, string> = {
  Staff:    'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Overhead: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  OpEx:     'bg-rose-500/10   text-rose-400   border-rose-500/30',
};

const TOP_ACCENT: Record<NodeCategory, string> = {
  Staff:    'border-t-orange-500',
  Overhead: 'border-t-violet-500',
  OpEx:     'border-t-rose-500',
};

const ICON_COLOR: Record<NodeCategory, string> = {
  Staff:    'text-orange-400',
  Overhead: 'text-violet-400',
  OpEx:     'text-rose-400',
};

const formatCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(v);

export default function ExpenseNode({ id, data }: NodeProps<ExpenseNodeData>) {
  const { setNodes } = useReactFlow();

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value) || 0;
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, value } } : n))
      );
    },
    [id, setNodes]
  );

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const category = e.target.value as NodeCategory;
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, category } } : n))
      );
    },
    [id, setNodes]
  );

  const topAccent = data.isolated ? 'border-t-yellow-500' : TOP_ACCENT[data.category];
  const iconColor = data.isolated ? 'text-yellow-400' : ICON_COLOR[data.category];

  return (
    <div
      className={`rounded-lg border border-slate-800 border-t-2 ${topAccent} bg-slate-900 p-3 min-w-[190px] shadow-md`}
    >
      {/* Only expose handles when standalone or in What-If mode */}
      {(!data.groupId || data.isolated) && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-rose-500 !border !border-rose-700"
        />
      )}

      <div className="flex items-center gap-1.5 mb-2">
        <ArrowDownCircle className={`w-3 h-3 shrink-0 ${iconColor}`} strokeWidth={1.5} />
        <span className="text-xs font-semibold text-slate-200 truncate flex-1">{data.label}</span>
        {data.isolated && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 font-bold shrink-0">
            WHAT-IF
          </span>
        )}
        <select
          value={data.category}
          onChange={handleCategoryChange}
          className={`text-[10px] rounded px-1 py-0.5 border nodrag shrink-0 ${CATEGORY_STYLE[data.category]}`}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <input
        type="number"
        value={data.value}
        onChange={handleValueChange}
        className="w-full bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500/50 nodrag"
        placeholder="0"
        min={0}
      />
      <p className="text-[10px] text-rose-600/80 mt-1">{formatCAD(data.value)} / mo</p>

      {(!data.groupId || data.isolated) && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-rose-500 !border !border-rose-700"
        />
      )}
    </div>
  );
}
