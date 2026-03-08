'use client';

import { AlertTriangle, TrendingDown, Heart, BarChart2, Brain, TrendingUp, DollarSign, Activity } from 'lucide-react';
import type { AccountantAnalysis, FinancialHealthReport, MacroTrendsBriefing, SyncStatus } from '@/types/api';

const fmtCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function HealthGauge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-rose-600';
  const label = score >= 70 ? 'Healthy' : score >= 40 ? 'At Risk' : 'Critical';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--moss)' }}>Financial Health Score</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${textColor}`}>{label}</span>
          <span className="text-sm font-black tabular-nums" style={{ color: 'var(--forest)' }}>{score}<span className="text-[10px]" style={{ color: 'var(--moss)' }}>/100</span></span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--forest-rim)' }}>
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function MetricRow({ label, value, color = '' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 last:border-0" style={{ borderBottom: '1px solid var(--forest-rim)' }}>
      <span className="text-xs" style={{ color: 'var(--moss)' }}>{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${color || ''}`} style={!color ? { color: 'var(--forest)' } : {}}>{value}</span>
    </div>
  );
}

function MacroTicker({ macro }: { macro: MacroTrendsBriefing }) {
  const trendColor = macro.trend_label === 'tightening'
    ? 'text-rose-600 bg-rose-50 border-rose-200'
    : macro.trend_label === 'easing'
    ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : 'text-amber-600 bg-amber-50 border-amber-200';

  return (
    <div className="rounded-lg p-3 space-y-2.5" style={{ border: '1px solid var(--forest-rim)', background: '#fff' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" style={{ color: 'var(--sage)' }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>Macro Trends</span>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase ${trendColor}`}>
          {macro.trend_label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'BoC Rate', value: macro.current_overnight_rate != null ? `${macro.current_overnight_rate.toFixed(2)}%` : '—' },
          { label: 'CPI', value: macro.current_cpi != null ? `${macro.current_cpi}%` : '—' },
          { label: 'CAD/USD', value: macro.cad_usd_rate != null ? macro.cad_usd_rate.toFixed(3) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded p-1.5 text-center" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)' }}>
            <p className="text-[9px] mb-0.5" style={{ color: 'var(--moss)' }}>{label}</p>
            <p className="text-xs font-bold tabular-nums" style={{ color: 'var(--forest)' }}>{value}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--moss)' }}>{macro.smb_impact_summary}</p>
    </div>
  );
}

interface Props {
  analysis: AccountantAnalysis | null;
  geminiReport: FinancialHealthReport | null;
  macro: MacroTrendsBriefing | null;
  syncStatus: SyncStatus;
}

export default function InsightsTab({ analysis, geminiReport, macro, syncStatus }: Props) {
  if (syncStatus === 'syncing' && !geminiReport && !analysis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Brain className="w-8 h-8 animate-pulse" style={{ color: 'var(--sage)' }} />
        <p className="text-sm" style={{ color: 'var(--moss)' }}>Analysing your canvas…</p>
      </div>
    );
  }

  const hasData = geminiReport || analysis;

  if (!hasData) {
    return (
      <div className="flex-1 flex flex-col gap-4 p-4">
        <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)' }}>
            <Brain className="w-6 h-6" style={{ color: 'var(--moss)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--forest)' }}>AI Insights</p>
            <p className="text-xs mt-2 leading-relaxed max-w-[180px] mx-auto" style={{ color: 'var(--moss)' }}>
              {syncStatus === 'error'
                ? 'Backend offline — start the FastAPI server.'
                : 'Add nodes to the canvas — insights appear automatically.'}
            </p>
          </div>
        </div>
        {macro && <MacroTicker macro={macro} />}
      </div>
    );
  }

  const healthScore    = geminiReport?.health_score    ?? analysis?.health_score    ?? 0;
  const netProfit      = geminiReport?.net_profit       ?? analysis?.financial_markers?.net_profit ?? 0;
  const margin         = geminiReport?.profit_margin_pct ?? analysis?.gross_margin_pct ?? 0;
  const breakEven      = geminiReport?.break_even_revenue ?? 0;
  const maxRent        = geminiReport?.max_affordable_rent ?? analysis?.financial_markers?.max_affordable_rent ?? 0;
  const revenue        = geminiReport?.monthly_revenue ?? analysis?.financial_markers?.monthly_revenue ?? 0;
  const expenses       = geminiReport?.monthly_expenses ?? analysis?.financial_markers?.monthly_expenses ?? 0;
  const costRisks      = geminiReport?.top_cost_risks ?? analysis?.top_cost_drivers ?? [];
  const warnings       = geminiReport?.warnings ?? analysis?.warnings ?? [];
  const recommendation = geminiReport?.recommendation ?? null;

  const profitColor = netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600';
  const marginColor = margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {/* Health score */}
      <div className="rounded-lg p-3 space-y-3" style={{ border: '1px solid var(--forest-rim)', background: '#fff' }}>
        <div className="flex items-center gap-2">
          <Heart className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>Business Health</span>
        </div>
        <HealthGauge score={healthScore} />
      </div>

      {/* AI recommendation */}
      {recommendation && (
        <div className="rounded-lg p-3 space-y-1.5" style={{ border: '1px solid var(--forest-rim)', background: '#f0f7ee' }}>
          <div className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" style={{ color: 'var(--sage)' }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>AI Recommendation</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--forest)' }}>{recommendation}</p>
        </div>
      )}

      {/* Key metrics */}
      <div className="rounded-lg p-3" style={{ border: '1px solid var(--forest-rim)', background: '#fff' }}>
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="w-3.5 h-3.5" style={{ color: 'var(--sage)' }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>Key Metrics</span>
        </div>
        <MetricRow label="Monthly Revenue"    value={fmtCAD(revenue)}   color="text-emerald-600" />
        <MetricRow label="Monthly Expenses"   value={fmtCAD(expenses)}  color="text-rose-600" />
        <MetricRow label="Net Profit"         value={fmtCAD(netProfit)} color={profitColor} />
        <MetricRow label="Profit Margin"      value={fmtPct(margin)}    color={marginColor} />
        {breakEven > 0 && (
          <MetricRow label="Break-Even Revenue" value={fmtCAD(breakEven)} color="text-amber-600" />
        )}
        <MetricRow label="Max Affordable Rent" value={fmtCAD(maxRent)} color="text-blue-600" />
      </div>

      {/* Cost risks */}
      {costRisks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>Top Cost Risks</span>
          </div>
          <div className="space-y-1.5">
            {costRisks.map((d) => (
              <div key={d} className="px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-700 leading-relaxed">
                {d}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>Warnings</span>
          </div>
          <div className="space-y-1.5">
            {warnings.map((w) => (
              <div key={w} className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 leading-relaxed">
                {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Segment Margins */}
      {geminiReport?.segment_margins && geminiReport.segment_margins.length > 0 && (
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--forest-rim)', background: '#fff' }}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>Segment Margins</span>
          </div>
          <div className="space-y-2">
            {geminiReport.segment_margins.map((seg) => (
              <div key={seg.segment_name} className="flex flex-col gap-1 py-1.5 last:border-0" style={{ borderBottom: '1px solid var(--forest-rim)' }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: 'var(--forest)' }}>{seg.segment_name}</span>
                  <span className={`text-xs font-bold tabular-nums ${seg.margin_pct >= 20 ? 'text-emerald-600' : seg.margin_pct >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {fmtPct(seg.margin_pct)}
                  </span>
                </div>
                <div className="flex justify-between items-center opacity-70">
                  <span className="text-[10px]" style={{ color: 'var(--moss)' }}>Rev: {fmtCAD(seg.revenue)}</span>
                  <span className="text-[10px]" style={{ color: 'var(--moss)' }}>Exp: {fmtCAD(seg.expenses)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Macro trends */}
      {macro && <MacroTicker macro={macro} />}

    </div>
  );
}
