'use client';

import { useCallback, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
  import { ArrowDownCircle } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import type { ExpenseNodeData, NodeCategory } from '@/types/nodes';

const CATEGORIES: NodeCategory[] = [
  'Physical Storefront',
  'E-Commerce & Online',
  'Marketplace',
  'Wholesale & B2B',
  'Delivery & Fulfillment',
  'Staff & Labour',
  'Marketing & Acquisition',
  'Payments & Banking',
  'Compliance & Admin',
  'Inventory & Suppliers',
];

const CATEGORY_STYLE: Record<NodeCategory, string> = {
  'Physical Storefront':     'bg-teal-500/10 text-teal-600 border-teal-400/40',
  'E-Commerce & Online':     'bg-blue-500/10 text-blue-600 border-blue-400/40',
  'Marketplace':             'bg-indigo-500/10 text-indigo-600 border-indigo-400/40',
  'Wholesale & B2B':         'bg-slate-500/10 text-slate-600 border-slate-400/40',
  'Delivery & Fulfillment':  'bg-amber-500/10 text-amber-600 border-amber-400/40',
  'Staff & Labour':          'bg-orange-500/10 text-orange-600 border-orange-400/40',
  'Marketing & Acquisition': 'bg-pink-500/10 text-pink-600 border-pink-400/40',
  'Payments & Banking':      'bg-green-500/10 text-green-600 border-green-400/40',
  'Compliance & Admin':      'bg-purple-500/10 text-purple-600 border-purple-400/40',
  'Inventory & Suppliers':   'bg-yellow-500/10 text-yellow-600 border-yellow-400/40',
};

const TOP_ACCENT: Record<NodeCategory, string> = {
  'Physical Storefront':     '#14b8a6',
  'E-Commerce & Online':     '#3b82f6',
  'Marketplace':             '#6366f1',
  'Wholesale & B2B':         '#64748b',
  'Delivery & Fulfillment':  '#f59e0b',
  'Staff & Labour':          '#f97316',
  'Marketing & Acquisition': '#ec4899',
  'Payments & Banking':      '#10b981',
  'Compliance & Admin':      '#a855f7',
  'Inventory & Suppliers':   '#eab308',
};

const ICON_COLOR: Record<NodeCategory, string> = {
  'Physical Storefront':     'text-teal-500',
  'E-Commerce & Online':     'text-blue-500',
  'Marketplace':             'text-indigo-500',
  'Wholesale & B2B':         'text-slate-500',
  'Delivery & Fulfillment':  'text-amber-500',
  'Staff & Labour':          'text-orange-500',
  'Marketing & Acquisition': 'text-pink-500',
  'Payments & Banking':      'text-green-500',
  'Compliance & Admin':      'text-purple-500',
  'Inventory & Suppliers':   'text-yellow-500',
};

const formatCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(v);

export default function ExpenseNode({ id, data }: NodeProps<ExpenseNodeData>) {
  const { setNodes, setEdges, getEdges } = useReactFlow();
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(data.label);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [id, setNodes, setEdges]
  );

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

  const handleLabelChange = useCallback(
    (newLabel: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n))
      );
    },
    [id, setNodes]
  );

  const handleLabelBlur = () => {
    if (labelInput.trim()) {
      handleLabelChange(labelInput.trim());
    } else {
      setLabelInput(data.label);
    }
    setIsEditingLabel(false);
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLabelBlur();
    } else if (e.key === 'Escape') {
      setLabelInput(data.label);
      setIsEditingLabel(false);
    }
  };

  const topAccentColor = data.isolated ? '#eab308' : TOP_ACCENT[data.category];
  const iconColor = data.isolated ? 'text-yellow-500' : ICON_COLOR[data.category];

  return (
    <div
      onContextMenu={handleDelete}
      className={`rounded-lg border border-t-2 p-3 w-[190px] shadow-sm transition-all ${
        data.isSelected ? 'ring-2 ring-rose-500 shadow-lg bg-rose-50' : data.isConnected ? 'ring-2 ring-rose-400 bg-rose-50/50' : ''
      }`}
      style={{
        background: '#ffffff',
        borderColor: 'var(--forest-rim)',
        borderTopColor: topAccentColor,
      }}
    >
      {/* Row 1: Label */}
      <div className="flex items-center gap-1.5 mb-2">
        <ArrowDownCircle className={`w-3 h-3 shrink-0 ${iconColor}`} strokeWidth={1.5} />
        {isEditingLabel ? (
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={handleLabelKeyDown}
            className="flex-1 text-xs font-semibold rounded px-1 py-0.5 nodrag focus:outline-none focus:ring-1 focus:ring-rose-500/50"
            style={{
              background: 'var(--forest-mid)',
              border: '1px solid var(--forest-rim)',
              color: 'var(--forest)',
            }}
            autoFocus
          />
        ) : (
          <span 
            className="text-xs font-semibold truncate flex-1 cursor-pointer hover:bg-rose-50/50 px-1 py-0.5 rounded transition-colors"
            style={{ color: 'var(--forest)' }}
            onClick={() => {
              setIsEditingLabel(true);
              setLabelInput(data.label);
            }}
            title="Click to rename"
          >
            {data.label}
          </span>
        )}
        {data.isolated && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-600 font-bold shrink-0">
            WHAT-IF
          </span>
        )}
      </div>

      {/* Row 2: Category Dropdown */}
      <div className="mb-2">
        <select
          value={data.category}
          onChange={handleCategoryChange}
          className={`w-full text-[10px] rounded px-1 py-0.5 border nodrag ${CATEGORY_STYLE[data.category]}`}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Row 3: Dollar Amount */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--forest)' }}>$</span>
        <input
          type="number"
          value={data.value}
          onChange={handleValueChange}
          className="w-[75px] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500/50 nodrag"
          style={{
            background: 'var(--forest-mid)',
            border: '1px solid var(--forest-rim)',
            color: 'var(--forest)',
          }}
          placeholder="0"
          min={0}
        />
        <span className="text-xs font-semibold" style={{ color: 'var(--forest)' }}>/mo</span>
      </div>

      {(!data.groupId || data.isolated) && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !bg-rose-500 !border !border-rose-700"
        />
      )}
    </div>
  );
}
