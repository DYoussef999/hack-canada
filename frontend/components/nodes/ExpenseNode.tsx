'use client';

import { useCallback } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { ArrowDownCircle } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import type { ExpenseNodeData, NodeCategory } from '@/types/nodes';

const CATEGORIES: NodeCategory[] = ['Staff', 'Overhead', 'OpEx'];

const CATEGORY_STYLE: Record<NodeCategory, string> = {
  Staff:    'bg-orange-500/10 text-orange-600 border-orange-400/40',
  Overhead: 'bg-violet-500/10 text-violet-600 border-violet-400/40',
  OpEx:     'bg-rose-500/10   text-rose-600   border-rose-400/40',
};

const TOP_ACCENT: Record<NodeCategory, string> = {
  Staff:    '#f97316',
  Overhead: '#7c3aed',
  OpEx:     '#e11d48',
};

const ICON_COLOR: Record<NodeCategory, string> = {
  Staff:    'text-orange-500',
  Overhead: 'text-violet-500',
  OpEx:     'text-rose-500',
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

  const topAccentColor = data.isolated ? '#eab308' : TOP_ACCENT[data.category];
  const iconColor = data.isolated ? 'text-yellow-500' : ICON_COLOR[data.category];

  return (
    <div
      className="rounded-lg border border-t-2 p-3 min-w-[190px] shadow-sm"
      style={{
        background: '#ffffff',
        borderColor: 'var(--forest-rim)',
        borderTopColor: topAccentColor,
      }}
    >
      {(!data.groupId || data.isolated) && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-rose-500 !border !border-rose-700"
        />
      )}

      <div className="flex items-center gap-1.5 mb-2">
        <ArrowDownCircle className={`w-3 h-3 shrink-0 ${iconColor}`} strokeWidth={1.5} />
        <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--forest)' }}>{data.label}</span>
        {data.isolated && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-600 font-bold shrink-0">
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
        className="w-full rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500/50 nodrag"
        style={{
          background: 'var(--forest-mid)',
          border: '1px solid var(--forest-rim)',
          color: 'var(--forest)',
        }}
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
