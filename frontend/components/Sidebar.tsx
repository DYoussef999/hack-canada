'use client';

import { TrendingUp, ArrowDownCircle, Info, FileSpreadsheet } from 'lucide-react';

interface PaletteItemProps {
  label: string;
  description: string;
  nodeType: string;
  icon: React.ReactNode;
  accentClass: string;
}

function PaletteItem({ label, description, nodeType, icon, accentClass }: PaletteItemProps) {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-800 border-l-2 ${accentClass} bg-slate-800/40 cursor-grab active:cursor-grabbing hover:bg-slate-800/70 transition-colors select-none`}
    >
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xs font-semibold text-slate-200 leading-tight">{label}</p>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{description}</p>
      </div>
    </div>
  );
}

interface SidebarProps {
  onImportClick: () => void;
}

export default function Sidebar({ onImportClick }: SidebarProps) {
  return (
    <aside className="w-52 bg-slate-900/50 backdrop-blur-md border-r border-slate-800 flex flex-col p-3 gap-5 shrink-0 z-10">
      <div>
        <h2 className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2.5 px-0.5">
          Node Palette
        </h2>

        <div className="space-y-2">
          <PaletteItem
            label="Revenue Stream"
            description="Sales, grants, subscriptions"
            nodeType="source"
            icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />}
            accentClass="border-l-emerald-500"
          />
          <PaletteItem
            label="Expense"
            description="Wages, rent, inventory"
            nodeType="expense"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-rose-400" strokeWidth={1.5} />}
            accentClass="border-l-rose-500"
          />
        </div>
      </div>

      <div>
        <h2 className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2.5 px-0.5">
          Import
        </h2>
        <button
          onClick={onImportClick}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-800 border-l-2 border-l-blue-500 bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400 shrink-0" strokeWidth={1.5} />
          <div>
            <p className="text-xs font-semibold text-slate-200 leading-tight">Import CSV</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Paste spreadsheet data</p>
          </div>
        </button>
      </div>

      <div className="mt-auto flex gap-2 p-2.5 rounded-lg bg-slate-800/30 border border-slate-800">
        <Info className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-[10px] text-slate-600 leading-relaxed">
          Drag onto canvas. The{' '}
          <span className="text-blue-400">Financials</span> panel updates instantly.
        </p>
      </div>
    </aside>
  );
}
