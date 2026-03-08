'use client';

import { useCallback } from 'react';
import { Handle, Position, useNodes, useReactFlow, type NodeProps } from 'reactflow';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import type { GroupNodeData, AnyNodeData, GroupCategory } from '@/types/nodes';
import { GROUP_HEADER_H, COLLAPSED_GROUP_H, expandedGroupH } from '@/utils/groupLayout';
import type { Node } from 'reactflow';

const fmtCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v);

const ACCENT: Record<GroupCategory, { indicator: string; header: string; text: string }> = {
  revenue:  { indicator: 'bg-emerald-500', header: 'bg-emerald-500/10', text: 'text-emerald-400' },
  fixed:    { indicator: 'bg-violet-500',  header: 'bg-violet-500/10',  text: 'text-violet-400'  },
  variable: { indicator: 'bg-rose-500',    header: 'bg-rose-500/10',    text: 'text-rose-400'    },
  labor:    { indicator: 'bg-orange-500',  header: 'bg-orange-500/10',  text: 'text-orange-400'  },
};

export default function GroupNode({ id, data }: NodeProps<GroupNodeData>) {
  const { setNodes } = useReactFlow();
  const allNodes     = useNodes() as Node<AnyNodeData>[];

  const children = allNodes.filter((n) => n.parentNode === id);
  const total    = children.reduce((sum, n) => sum + (((n.data as { value?: number }).value) ?? 0), 0);
  const count    = children.length;

  const accent = ACCENT[data.groupCategory] ?? ACCENT.variable;

  const toggleCollapse = useCallback(() => {
    const newCollapsed = !data.collapsed;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            style: { ...n.style, height: newCollapsed ? COLLAPSED_GROUP_H : expandedGroupH(children.length) },
            data:  { ...n.data, collapsed: newCollapsed },
          };
        }
        if (n.parentNode === id) {
          return { ...n, hidden: newCollapsed };
        }
        return n;
      })
    );
  }, [id, data.collapsed, setNodes, children.length]);

  return (
    <div
      className="w-full h-full rounded-lg border border-slate-700 bg-slate-900 overflow-hidden"
      style={{ minHeight: GROUP_HEADER_H }}
    >
      {/* Group-level port handles — one per side, representing the aggregate total */}
      <Handle
        type="target"
        position={Position.Left}
        id="group-in"
        style={{ top: GROUP_HEADER_H / 2 }}
        className="!w-2 !h-2 !bg-slate-600 !border !border-slate-500 !rounded-sm"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="group-out"
        style={{ top: GROUP_HEADER_H / 2 }}
        className="!w-2 !h-2 !bg-slate-600 !border !border-slate-500 !rounded-sm"
      />

      {/* Accent indicator line */}
      <div className={`h-0.5 w-full ${accent.indicator}`} />

      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 border-b border-slate-800/70 ${accent.header} cursor-pointer select-none`}
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-1.5">
          <Layers className={`w-3 h-3 shrink-0 ${accent.text}`} strokeWidth={1.5} />
          <span className={`text-[11px] font-bold uppercase tracking-wider ${accent.text}`}>
            {data.label}
          </span>
          {count > 0 && (
            <span className="text-[10px] text-slate-600 tabular-nums">
              ({count})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-bold tabular-nums ${accent.text}`}>
            {fmtCAD(total)}
          </span>
          {data.collapsed
            ? <ChevronRight className="w-3 h-3 text-slate-600" strokeWidth={1.5} />
            : <ChevronDown  className="w-3 h-3 text-slate-600" strokeWidth={1.5} />
          }
        </div>
      </div>

      {/* Collapsed summary */}
      {data.collapsed && (
        <div className="px-3 py-2">
          <p className={`text-[10px] italic uppercase tracking-wider font-semibold ${accent.text} opacity-60`}>
            {count} item{count !== 1 ? 's' : ''} · {fmtCAD(total)}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!data.collapsed && count === 0 && (
        <div className="flex items-center justify-center py-4">
          <p className="text-[10px] text-slate-700 italic">Drag nodes here or use Import CSV</p>
        </div>
      )}
    </div>
  );
}
