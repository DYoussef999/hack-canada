'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, ArrowDownCircle } from 'lucide-react';
import type { CanvasFinancials, ExpenseBreakdownItem } from '@/hooks/useCanvasFinancials';
import type { AccountantAnalysis, FinancialHealthReport, MacroTrendsBriefing, SyncStatus } from '@/types/api';
import type { NodeCategory, SegmentResult } from '@/types/nodes';
import InsightsTab from '@/components/tabs/InsightsTab';
import { getMacro } from '@/services/compassApi';

type TabId = 'financials' | 'insights';
const TABS: { id: TabId; label: string }[] = [
  { id: 'financials', label: 'Financials'  },
  { id: 'insights',   label: 'AI Insights' },
];

const CATEGORY_META: Record<NodeCategory, { bar: string; badge: string; text: string }> = {
  Staff:    { bar: 'bg-orange-500', badge: 'bg-orange-50 text-orange-600 border-orange-200', text: 'text-orange-600' },
  Overhead: { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-600 border-violet-200', text: 'text-violet-600' },
  OpEx:     { bar: 'bg-rose-500',   badge: 'bg-rose-50   text-rose-600   border-rose-200',   text: 'text-rose-600'   },
};

const fmtCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
  }).format(v);

function CategoryBar({ category, value, total }: { category: NodeCategory; value: number; total: number }) {
  const pct = total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0;
  const meta = CATEGORY_META[category];
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${meta.text}`}>{category}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--moss)' }}>{pct}%</span>
          <span className="text-[10px] font-semibold tabular-nums" style={{ color: 'var(--forest)' }}>{fmtCAD(value)}</span>
        </div>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--forest-rim)' }}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${meta.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SegmentCard({ seg }: { seg: SegmentResult }) {
  const isPositive = seg.grossMargin >= 0;
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--forest-rim)' }}>
      <div className="flex items-center justify-between px-2.5 py-2" style={{ background: 'var(--forest-mid)', borderBottom: '1px solid var(--forest-rim)' }}>
        <span className="text-[10px] font-semibold truncate flex-1 pr-2" style={{ color: 'var(--forest)' }}>{seg.label}</span>
        <span className={`text-[10px] font-bold tabular-nums shrink-0 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {fmtCAD(seg.grossMargin)}
        </span>
      </div>
      <div className="px-2.5 py-2 space-y-1.5" style={{ background: '#fff' }}>
        <div className="flex justify-between text-[10px]">
          <span style={{ color: 'var(--moss)' }}>Revenue</span>
          <span className="text-emerald-600 tabular-nums">{fmtCAD(seg.revenue)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span style={{ color: 'var(--moss)' }}>Direct Costs</span>
          <span className="text-amber-600 tabular-nums">{fmtCAD(seg.directCosts)}</span>
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span style={{ color: 'var(--moss)' }}>Gross Margin</span>
            <span className={`font-bold tabular-nums ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {seg.grossMarginPct}%
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--forest-rim)' }}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.max(0, Math.min(100, Math.abs(seg.grossMarginPct)))}%` }}
            />
          </div>
        </div>
        {seg.linkedExpenses.length > 0 && (
          <div className="pt-1 space-y-0.5" style={{ borderTop: '1px solid var(--forest-rim)' }}>
            {seg.linkedExpenses.map((exp, i) => (
              <div key={i} className="flex justify-between text-[9px]">
                <span className="truncate flex-1 pr-2" style={{ color: 'var(--moss)' }}>{exp.label}</span>
                <span className="text-amber-600/80 tabular-nums shrink-0">{fmtCAD(exp.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseRow({ item, total }: { item: ExpenseBreakdownItem; total: number }) {
  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
  const meta = CATEGORY_META[item.category];
  return (
    <div className="flex items-center gap-2 py-1.5 last:border-0" style={{ borderBottom: '1px solid var(--forest-rim)' }}>
      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${meta.badge}`}>
        {item.category}
      </span>
      <p className="text-xs truncate flex-1" style={{ color: 'var(--forest)' }}>{item.label}</p>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold tabular-nums" style={{ color: 'var(--forest)' }}>{fmtCAD(item.value)}</p>
        <p className="text-[9px] mt-0.5" style={{ color: 'var(--moss)' }}>{pct}%</p>
      </div>
    </div>
  );
}

function FinancialsTab({ f, syncStatus }: { f: CanvasFinancials; syncStatus: SyncStatus }) {
  const { revenue, totalExpenses, netProfit, expenseBreakdown, segments } = f;
  const isPositive = netProfit >= 0;
  const margin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

  const catTotals: Record<NodeCategory, number> = { Staff: 0, Overhead: 0, OpEx: 0 };
  for (const item of expenseBreakdown) catTotals[item.category] += item.value;
  const hasExpenses = totalExpenses > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4" style={{ borderBottom: '1px solid var(--forest-rim)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>Monthly Net Profit</p>
          {syncStatus === 'syncing' && <span className="text-[9px] text-blue-500 animate-pulse">AI syncing…</span>}
          {syncStatus === 'synced'  && <span className="text-[9px] text-emerald-600">● synced</span>}
          {syncStatus === 'error'   && <span className="text-[9px]" style={{ color: 'var(--moss)' }}>● offline</span>}
        </div>
        <p className={`text-3xl font-black tabular-nums leading-none tracking-tight ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {fmtCAD(netProfit)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)' }}>
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="w-2.5 h-2.5 text-emerald-600" strokeWidth={1.5} />
              <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--moss)' }}>Revenue</span>
            </div>
            <p className="text-sm font-bold text-emerald-600 tabular-nums">{fmtCAD(revenue)}</p>
          </div>
          <div className="rounded-lg p-2" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)' }}>
            <div className="flex items-center gap-1 mb-0.5">
              <ArrowDownCircle className="w-2.5 h-2.5 text-rose-500" strokeWidth={1.5} />
              <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--moss)' }}>Expenses</span>
            </div>
            <p className="text-sm font-bold text-rose-600 tabular-nums">{fmtCAD(totalExpenses)}</p>
          </div>
        </div>
        {revenue > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] mb-1">
              <span style={{ color: 'var(--moss)' }}>Profit Margin</span>
              <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>{margin}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--forest-rim)' }}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, Math.abs(margin)))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-4" style={{ borderBottom: '1px solid var(--forest-rim)' }}>
        <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--moss)' }}>Cost Breakdown</p>
        {!hasExpenses ? (
          <p className="text-[10px] text-center py-4 italic" style={{ color: 'var(--moss)' }}>Add an expense node to see breakdown</p>
        ) : (
          <div className="space-y-3">
            {(Object.keys(catTotals) as NodeCategory[])
              .filter((cat) => catTotals[cat] > 0)
              .map((cat) => (
                <CategoryBar key={cat} category={cat} value={catTotals[cat]} total={totalExpenses} />
              ))}
          </div>
        )}
      </div>

      {segments.length > 0 && (
        <div className="p-4" style={{ borderBottom: '1px solid var(--forest-rim)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>Segment Profitability</p>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-600 font-bold">
              {segments.length}
            </span>
          </div>
          <div className="space-y-2">
            {segments.map((seg) => <SegmentCard key={seg.id} seg={seg} />)}
          </div>
        </div>
      )}

      {expenseBreakdown.length > 0 && (
        <div className="p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--moss)' }}>All Line Items</p>
          <div>
            {expenseBreakdown.map((item) => (
              <ExpenseRow key={item.id} item={item} total={totalExpenses} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  financials: CanvasFinancials;
  sessionId: string | null;
  aiAnalysis: AccountantAnalysis | null;
  geminiReport: FinancialHealthReport | null;
  syncStatus: SyncStatus;
  width?: number;
}

export default function SummarySidebar({ financials, sessionId, aiAnalysis, geminiReport, syncStatus, width }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('financials');
  const [macro, setMacro] = useState<MacroTrendsBriefing | null>(null);

  useEffect(() => {
    getMacro().then(setMacro).catch(() => {});
  }, []);

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden"
      style={{ background: 'var(--cream)', borderLeft: '1px solid var(--forest-rim)', width: width ?? 288 }}
    >
      <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--forest-rim)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex-1 py-2.5 text-[10px] font-semibold transition-colors"
            style={activeTab === t.id
              ? { color: 'var(--forest)', borderBottom: '2px solid var(--sage)', marginBottom: '-1px' }
              : { color: 'var(--moss)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'financials' && (
        <FinancialsTab f={financials} syncStatus={syncStatus} />
      )}
      {activeTab === 'insights' && (
        <InsightsTab
          analysis={aiAnalysis}
          geminiReport={geminiReport}
          macro={macro}
          syncStatus={syncStatus}
        />
      )}
    </aside>
  );
}
