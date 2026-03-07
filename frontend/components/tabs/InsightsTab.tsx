'use client';

import { AlertTriangle, TrendingDown, Heart, BarChart2, Brain } from 'lucide-react';
import type { AccountantAnalysis, SyncStatus } from '@/types/api';

const fmtCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v);

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-500">Financial Health</span>
        <span className="text-zinc-200 font-semibold">{score}/100</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

interface Props {
  analysis: AccountantAnalysis | null;
  syncStatus: SyncStatus;
}

export default function InsightsTab({ analysis, syncStatus }: Props) {
  if (syncStatus === 'syncing') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Brain className="w-8 h-8 text-blue-500 animate-pulse" />
        <p className="text-sm text-zinc-400">Analysing your canvas…</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <Brain className="w-6 h-6 text-zinc-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-300">AI Insights</p>
          <p className="text-xs text-zinc-600 mt-2 leading-relaxed max-w-[180px] mx-auto">
            {syncStatus === 'error'
              ? 'Backend offline — start the FastAPI server to enable AI analysis.'
              : 'Add nodes to the canvas. Insights will appear automatically.'}
          </p>
        </div>
        {syncStatus === 'error' && (
          <span className="text-[11px] px-3 py-1 rounded-full bg-red-950 border border-red-800 text-red-400">
            Backend offline
          </span>
        )}
      </div>
    );
  }

  const health_score     = analysis.health_score     ?? 0;
  const burn_rate        = analysis.burn_rate        ?? 0;
  const gross_margin_pct = analysis.gross_margin_pct ?? 0;
  const runway_months    = analysis.runway_months;
  const top_cost_drivers = analysis.top_cost_drivers ?? [];
  const warnings         = analysis.warnings         ?? [];
  const max_rent         = analysis.financial_markers?.max_affordable_rent ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* Health score */}
      <div className="border border-zinc-800 rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="w-3.5 h-3.5 text-pink-400" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Business Health</span>
        </div>
        <HealthBar score={health_score} />
      </div>

      {/* Key metrics */}
      <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Key Metrics</span>
        </div>
        {[
          { label: 'Monthly Burn Rate',   value: fmtCAD(burn_rate),                       color: 'text-red-400' },
          { label: 'Gross Margin',        value: `${gross_margin_pct.toFixed(1)}%`,        color: gross_margin_pct >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Max Affordable Rent', value: fmtCAD(max_rent),                         color: 'text-blue-400' },
          { label: 'Runway',              value: runway_months != null ? `${runway_months} mo` : 'N/A', color: 'text-zinc-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">{label}</span>
            <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Top cost drivers */}
      {top_cost_drivers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Top Cost Drivers</span>
          </div>
          <div className="space-y-1.5">
            {top_cost_drivers.map((d) => (
              <div key={d} className="px-3 py-2 rounded-lg bg-orange-950/40 border border-orange-900/50 text-xs text-orange-300">
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
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Warnings</span>
          </div>
          <div className="space-y-1.5">
            {warnings.map((w) => (
              <div key={w} className="px-3 py-2 rounded-lg bg-yellow-950/40 border border-yellow-900/50 text-xs text-yellow-300 leading-relaxed">
                {w}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
