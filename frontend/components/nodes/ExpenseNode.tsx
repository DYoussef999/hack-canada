'use client';

import { useCallback } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { ArrowDownCircle } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import type { ExpenseNodeData, NodeCategory } from '@/types/nodes';

const CATEGORIES: NodeCategory[] = ['Staff', 'Overhead', 'OpEx'];

const CATEGORY_STYLE: Record<NodeCategory, string> = {
  Staff: 'bg-orange-950 text-orange-300 border-orange-800',
  Overhead: 'bg-purple-950 text-purple-300 border-purple-800',
  OpEx: 'bg-red-900 text-red-300 border-red-700',
};

const formatCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(v);

/**
 * ExpenseNode — represents a cost category such as wages, rent, or utilities.
 *
 * Has both input (left) and output (right) Handles, enabling cost chaining.
 * Category tag (Staff / Overhead / OpEx) is editable via a dropdown.
 */
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

  return (
    <div className="rounded-xl border-2 border-red-500 bg-red-950 p-4 min-w-[210px] shadow-lg">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-red-400 !border-2 !border-red-700"
      />

      <div className="flex items-center gap-2 mb-3">
        <ArrowDownCircle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-sm font-semibold text-red-200 truncate flex-1">{data.label}</span>
        <select
          value={data.category}
          onChange={handleCategoryChange}
          className={`text-xs rounded px-1.5 py-0.5 border nodrag shrink-0 ${CATEGORY_STYLE[data.category]}`}
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
        className="w-full bg-red-900 border border-red-700 rounded-lg px-3 py-2 text-red-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 nodrag"
        placeholder="0"
        min={0}
      />
      <p className="text-xs text-red-600 mt-1.5">{formatCAD(data.value)} / mo</p>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-red-400 !border-2 !border-red-700"
      />
    </div>
  );
}
