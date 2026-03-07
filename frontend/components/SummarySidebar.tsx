'use client';

import { useState } from 'react';
import { TrendingUp, ArrowDownCircle, Zap, Brain } from 'lucide-react';
import type { CanvasFinancials, ExpenseBreakdownItem } from '@/hooks/useCanvasFinancials';
import type { AccountantAnalysis, SyncStatus } from '@/types/api';
import type { NodeCategory } from '@/types/nodes';
import InsightsTab from '@/components/tabs/InsightsTab';
import OptimizationTab from '@/components/tabs/OptimizationTab';

type TabId = 'financials' | 'optimization' | 'insights';
const TABS: { id: TabId; label: string }[] = [
  { id: 'financials',   label: 'Financials' },
  { id: 'optimization', label: 'Optimization' },
  { id: 'insights',     label: 'AI Insights' },
];

const CATEGORY_STYLE: Record<NodeCategory, string> = {
  Staff:    'bg-orange-950 text-orange-400 border-orange-800',
  Overhead: 'bg-purple-950 text-purple-400 border-purple-800',
  OpEx:     'bg-blue-950  text-blue-400   border-blue-800',
};

const fmtCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
  }).format(v);

function ExpenseRow({ item, total }: { item: ExpenseBreakdownItem; total: number }) {
  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800">
      <div className="flex-1 min-w-0">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${CATEGORY_STYLE[item.category]}`}>
          {item.category}
        </span>
        <p className="text-xs text-zinc-300 truncate mt-1">{item.label}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold text-red-400 tabular-nums">{fmtCAD(item.value)}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{pct}%</p>
      </div>
    </div>
  );
}

function FinancialsTab({
  f,
  syncStatus,
}: {
  f: CanvasFinancials;
  syncStatus: SyncStatus;
}) {
  const { revenue, totalExpenses, netProfit, expenseBreakdown } = f;
  const isPositive = netProfit >= 0;
  const margin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* Hero number */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Monthly Snapshot</p>
          {syncStatus === 'syncing' && (
            <span className="text-[10px] text-blue-400 animate-pulse">AI syncing…</span>
          )}
          {syncStatus === 'synced' && (
            <span className="text-[10px] text-green-500">✓ Synced</span>
          )}
          {syncStatus === 'error' && (
            <span className="text-[10px] text-zinc-600">offline</span>
          )}
        </div>
        <p className={`text-4xl font-extrabold tabular-nums leading-none ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {fmtCAD(netProfit)}
        </p>
        <p className="text-xs text-zinc-600 mt-1.5">Total Net Profit</p>
      </div>

      {/* Summary card */}
      <div className="border border-zinc-800 rounded-lg p-3 space-y-2.5">
        <div className="flex justify-between items-center text-sm">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <TrendingUp className="w-3.5 h-3.5 text-green-500" /> Revenue
          </span>
          <span className="text-green-400 tabular-nums font-semibold">{fmtCAD(revenue)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <ArrowDownCircle className="w-3.5 h-3.5 text-red-500" /> Expenses
          </span>
          <span className="text-red-400 tabular-nums font-semibold">{fmtCAD(totalExpenses)}</span>
        </div>
        {revenue > 0 && (
          <div className="pt-2 border-t border-zinc-800">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-zinc-600">Profit Margin</span>
              <span className={isPositive ? 'text-green-500' : 'text-red-500'}>{margin}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, margin))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cost breakdown */}
      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5">Cost Breakdown</p>
        {expenseBreakdown.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-8 leading-relaxed">
            Drag an <span className="text-red-400 font-medium">Expense</span> node<br />onto the canvas to see a breakdown.
          </p>
        ) : (
          <div className="space-y-1.5">
            {expenseBreakdown.map((item) => (
              <ExpenseRow key={item.id} item={item} total={totalExpenses} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  financials: CanvasFinancials;
  sessionId: string | null;
  aiAnalysis: AccountantAnalysis | null;
  syncStatus: SyncStatus;
}

export default function SummarySidebar({ financials, sessionId, aiAnalysis, syncStatus }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('financials');
  const backendOnline = syncStatus !== 'error';

  return (
    <aside className="w-72 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0 overflow-hidden">
      <div className="flex shrink-0 border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-3 text-[11px] font-semibold transition-colors ${
              activeTab === t.id
                ? 'text-zinc-100 border-b-2 border-blue-500 -mb-px'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'financials' && (
        <FinancialsTab f={financials} syncStatus={syncStatus} />
      )}
      {activeTab === 'optimization' && (
        <OptimizationTab sessionId={sessionId} backendOnline={backendOnline} />
      )}
      {activeTab === 'insights' && (
        <InsightsTab analysis={aiAnalysis} syncStatus={syncStatus} />
      )}
    </aside>
  );
}
