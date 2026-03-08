'use client';

import { useCallback, useState } from 'react';
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

  return (
    <div
      onContextMenu={handleDelete}
      className={`rounded-lg border border-t-2 p-3 w-[190px] shadow-sm transition-all ${
        data.isSelected ? 'ring-2 ring-emerald-500 shadow-lg bg-emerald-50' : data.isConnected ? 'ring-2 ring-emerald-400 bg-emerald-50/50' : ''
      }`}
      style={{
        background: '#ffffff',
        borderColor: 'var(--forest-rim)',
        borderTopColor: data.isolated ? '#eab308' : '#16a34a',
      }}
    >
      {/* Row 1: Label */}
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp
          className={`w-3 h-3 shrink-0 ${data.isolated ? 'text-yellow-500' : 'text-emerald-600'}`}
          strokeWidth={1.5}
        />
        {isEditingLabel ? (
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={handleLabelKeyDown}
            className="flex-1 text-xs font-semibold rounded px-1 py-0.5 nodrag focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            style={{
              background: 'var(--forest-mid)',
              border: '1px solid var(--forest-rim)',
              color: 'var(--forest)',
            }}
            autoFocus
          />
        ) : (
          <span 
            className="text-xs font-semibold truncate flex-1 cursor-pointer hover:bg-emerald-50/50 px-1 py-0.5 rounded transition-colors"
            style={{ color: 'var(--forest)' }}
            onClick={() => {
              setIsEditingLabel(true);
              setLabelInput(data.label);
            }}
            title={data.isSelected ? data.label : "Click to rename"}
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

      {/* Row 3: Dollar Amount */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--forest)' }}>$</span>
        <input
          type="number"
          value={data.value}
          onChange={handleValueChange}
          className="w-[75px] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 nodrag"
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
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !bg-emerald-500 !border !border-emerald-700"
        />
      )}
    </div>
  );
}
