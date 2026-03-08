'use client';

import { TrendingUp, ArrowDownCircle, Info, FileSpreadsheet, Grid3x3, Zap } from 'lucide-react';

interface PaletteItemProps {
  label: string;
  description: string;
  nodeType: string;
  icon: React.ReactNode;
  accentClass: string;
  category?: string;
}

function PaletteItem({ label, description, nodeType, icon, accentClass, category }: PaletteItemProps) {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const dragData = category ? `${nodeType}:${category}` : nodeType;
    e.dataTransfer.setData('application/reactflow', dragData);
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
  onCleanupClick: () => void;
  onAutoWireClick: () => void;
  isAutoWiring?: boolean;
}

export default function Sidebar({ onImportClick, onCleanupClick, onAutoWireClick, isAutoWiring = false }: SidebarProps) {
  return (
    <aside className="w-52 flex flex-col p-3 gap-5 shrink-0 z-10 overflow-y-auto" style={{ background: 'var(--cream)', borderRight: '1px solid var(--forest-rim)' }}>
      <div>
        <h2 className="text-[9px] font-bold uppercase tracking-widest mb-2.5 px-0.5" style={{ color: 'var(--moss)' }}>
          Revenue
        </h2>

        <div className="space-y-2">
          <PaletteItem
            label="Revenue Stream"
            description="Sales, grants, subscriptions"
            nodeType="source"
            icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />}
            accentClass="border-l-emerald-500"
          />
        </div>
      </div>

      <div>
        <h2 className="text-[9px] font-bold uppercase tracking-widest mb-2.5 px-0.5" style={{ color: 'var(--moss)' }}>
          Expense Types
        </h2>

        <div className="space-y-2">
          <PaletteItem
            label="Physical Storefront"
            description="Retail location & fixtures"
            nodeType="expense"
            category="Physical Storefront"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-teal-500" strokeWidth={1.5} />}
            accentClass="border-l-teal-500"
          />
          <PaletteItem
            label="E-Commerce & Online"
            description="Digital platform costs"
            nodeType="expense"
            category="E-Commerce & Online"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-blue-500" strokeWidth={1.5} />}
            accentClass="border-l-blue-500"
          />
          <PaletteItem
            label="Marketplace"
            description="Commission & fees"
            nodeType="expense"
            category="Marketplace"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-indigo-500" strokeWidth={1.5} />}
            accentClass="border-l-indigo-500"
          />
          <PaletteItem
            label="Wholesale & B2B"
            description="Business transactions"
            nodeType="expense"
            category="Wholesale & B2B"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.5} />}
            accentClass="border-l-slate-500"
          />
          <PaletteItem
            label="Delivery & Fulfillment"
            description="Shipping & logistics"
            nodeType="expense"
            category="Delivery & Fulfillment"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />}
            accentClass="border-l-amber-500"
          />
          <PaletteItem
            label="Staff & Labour"
            description="Wages & benefits"
            nodeType="expense"
            category="Staff & Labour"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-orange-500" strokeWidth={1.5} />}
            accentClass="border-l-orange-500"
          />
          <PaletteItem
            label="Marketing & Acquisition"
            description="Ads & customer outreach"
            nodeType="expense"
            category="Marketing & Acquisition"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-pink-500" strokeWidth={1.5} />}
            accentClass="border-l-pink-500"
          />
          <PaletteItem
            label="Payments & Banking"
            description="Transaction fees"
            nodeType="expense"
            category="Payments & Banking"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-green-500" strokeWidth={1.5} />}
            accentClass="border-l-green-500"
          />
          <PaletteItem
            label="Compliance & Admin"
            description="Legal & administrative"
            nodeType="expense"
            category="Compliance & Admin"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-purple-500" strokeWidth={1.5} />}
            accentClass="border-l-purple-500"
          />
          <PaletteItem
            label="Inventory & Suppliers"
            description="COGS & raw materials"
            nodeType="expense"
            category="Inventory & Suppliers"
            icon={<ArrowDownCircle className="w-3.5 h-3.5 text-yellow-500" strokeWidth={1.5} />}
            accentClass="border-l-yellow-500"
          />
        </div>
      </div>

      <div>
        <h2 className="text-[9px] font-bold uppercase tracking-widest mb-2.5 px-0.5" style={{ color: 'var(--moss)' }}>
          Tools
        </h2>
        <div className="space-y-2">
          <button
            onClick={onCleanupClick}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--forest-rim)] border-l-2 border-l-blue-400 bg-white hover:bg-[var(--forest-mid)] transition-colors text-left"
          >
            <Grid3x3 className="w-3.5 h-3.5 shrink-0 text-blue-500" strokeWidth={1.5} />
            <div>
              <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--forest)' }}>Organize</p>
              <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--moss)' }}>Grid align by type</p>
            </div>
          </button>
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
          <button
            onClick={onAutoWireClick}
            disabled={isAutoWiring}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--forest-rim)] border-l-2 border-l-amber-400 bg-white hover:bg-[var(--forest-mid)] transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" strokeWidth={1.5} />
            <div>
              <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--forest)' }}>{isAutoWiring ? 'Wiring...' : 'Auto-wire'}</p>
              <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--moss)' }}>AI-matched connections</p>
            </div>
          </button>
        </div>
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
