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
      className={`flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--forest-rim)] border-l-2 ${accentClass} bg-white cursor-grab active:cursor-grabbing hover:bg-[var(--forest-mid)] transition-colors select-none`}
    >
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--forest)' }}>{label}</p>
        <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--moss)' }}>{description}</p>
      </div>
    </div>
  );
}

interface SidebarProps {
  onImportClick: () => void;
}

export default function Sidebar({ onImportClick }: SidebarProps) {
  return (
    <aside className="w-52 flex flex-col p-3 gap-5 shrink-0 z-10" style={{ background: 'var(--cream)', borderRight: '1px solid var(--forest-rim)' }}>
      <div>
        <h2 className="text-[9px] font-bold uppercase tracking-widest mb-2.5 px-0.5" style={{ color: 'var(--moss)' }}>
          Node Palette
        </h2>

        <div className="space-y-2">
          <PaletteItem
            label="Revenue Stream"
            description="Sales, grants, subscriptions"
            nodeType="source"
            icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />}
            accentClass="border-l-emerald-500"
          />
          <PaletteItem
            label="Expense"
            description="Wages, rent, inventory"
            nodeType="expense"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-rose-500" strokeWidth={1.5} />}
            accentClass="border-l-rose-500"
          />
        </div>
      </div>

      <div>
        <h2 className="text-[9px] font-bold uppercase tracking-widest mb-2.5 px-0.5" style={{ color: 'var(--moss)' }}>
          Import
        </h2>
        <button
          onClick={onImportClick}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--forest-rim)] border-l-2 border-l-[var(--sage)] bg-white hover:bg-[var(--forest-mid)] transition-colors text-left"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sage)' }} strokeWidth={1.5} />
          <div>
            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--forest)' }}>Import CSV</p>
            <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--moss)' }}>Paste spreadsheet data</p>
          </div>
        </button>
      </div>

      <div className="mt-auto flex gap-2 p-2.5 rounded-lg" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)' }}>
        <Info className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--moss)' }} strokeWidth={1.5} />
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--moss)' }}>
          Drag onto canvas. The{' '}
          <span style={{ color: 'var(--sage)', fontWeight: 600 }}>Financials</span> panel updates instantly.
        </p>
      </div>
    </aside>
  );
}
