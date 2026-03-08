'use client';

import { useState } from 'react';
import { Zap, MapPin, AlertTriangle, ChevronUp, ChevronDown, Map, Shield, TrendingUp } from 'lucide-react';
import { optimizeLocations, type CandidateLocation } from '@/services/compassApi';
import type { FinancialHealthReport, GeminiExpansionReport, RankedLocation, SyncStatus } from '@/types/api';

const fmtCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v);

const CITY_CONFIG: Record<string, { lat: number; lng: number; census_division: string }> = {
  Waterloo:    { lat: 43.4643, lng: -80.5204, census_division: '3530' },
  Kitchener:   { lat: 43.4516, lng: -80.4925, census_division: '3537' },
  Toronto:     { lat: 43.6532, lng: -79.3832, census_division: '3521' },
  Hamilton:    { lat: 43.2557, lng: -79.8711, census_division: '3525' },
  London:      { lat: 42.9849, lng: -81.2453, census_division: '3539' },
  Ottawa:      { lat: 45.4215, lng: -75.6919, census_division: '3506' },
  Mississauga: { lat: 43.5890, lng: -79.6441, census_division: '3521' },
  Brampton:    { lat: 43.7315, lng: -79.7624, census_division: '3521' },
};
const CITIES = Object.keys(CITY_CONFIG);

function VeScore({ score }: { score: number }) {
  const pct = Math.round(score);
  const color = pct >= 65 ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
              : pct >= 40 ? 'text-amber-600 border-amber-200 bg-amber-50'
              : 'text-rose-600 border-rose-200 bg-rose-50';
  return (
    <div className={`text-center px-2.5 py-1.5 rounded-lg border ${color}`}>
      <p className="text-[9px] text-current opacity-60 font-bold uppercase">Ve Score</p>
      <p className="text-lg font-black tabular-nums">{pct}</p>
    </div>
  );
}

function LocationCard({ loc, rank }: { loc: RankedLocation; rank: number }) {
  const [expanded, setExpanded] = useState(rank === 0);
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--forest-rim)', background: '#fff' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--forest-mid)]"
      >
        <span className="text-[10px] font-black w-4 shrink-0" style={{ color: 'var(--moss)' }}>#{rank + 1}</span>
        <MapPin className="w-3 h-3 shrink-0" style={{ color: 'var(--sage)' }} />
        <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--forest)' }}>{loc.city_name}</span>
        <span className="text-[10px] tabular-nums" style={{ color: 'var(--moss)' }}>{fmtCAD(loc.monthly_rent)}/mo</span>
        <VeScore score={loc.viability_score.computed_score} />
        {expanded
          ? <ChevronUp className="w-3 h-3" style={{ color: 'var(--moss)' }} />
          : <ChevronDown className="w-3 h-3" style={{ color: 'var(--moss)' }} />
        }
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 pt-2.5" style={{ borderTop: '1px solid var(--forest-rim)' }}>
          {loc.recommendation && (
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--moss)' }}>{loc.recommendation}</p>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded p-2" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)' }}>
              <p className="text-[9px] mb-0.5" style={{ color: 'var(--moss)' }}>Ve Score Formula</p>
              <p className="text-[10px] font-mono" style={{ color: 'var(--forest)' }}>
                ({fmtCAD(Math.round(loc.viability_score.p_rev))} × {(loc.viability_score.d_demographic * 100).toFixed(0)}%)
                <br />÷ (rent × comp + fixed)
              </p>
            </div>
            <div className="rounded p-2" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)' }}>
              <p className="text-[9px] mb-0.5" style={{ color: 'var(--moss)' }}>SME Score</p>
              <p className="text-xs font-bold" style={{ color: 'var(--forest)' }}>{(loc.viability_score.d_demographic * 100).toFixed(0)}/100</p>
              <p className="text-[9px]" style={{ color: 'var(--moss)' }}>Competition: {(loc.viability_score.s_competition * 100).toFixed(0)}/100</p>
            </div>
          </div>

          {loc.macro_risk_flag && (
            <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 leading-relaxed">{loc.macro_risk_flag}</p>
            </div>
          )}

          {loc.vulnerability_note && (
            <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)' }}>
              <Shield className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--moss)' }} />
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--moss)' }}>{loc.vulnerability_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MapPlaceholder() {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px dashed var(--forest-rim)' }}>
      <div className="px-3 py-2 flex items-center gap-1.5" style={{ borderBottom: '1px solid var(--forest-rim)' }}>
        <Map className="w-3.5 h-3.5" style={{ color: 'var(--moss)' }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>Location Map</span>
        <span className="ml-auto text-[9px] px-2 py-0.5 rounded" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)', color: 'var(--moss)' }}>
          Coming soon
        </span>
      </div>
      <div className="h-44 flex flex-col items-center justify-center gap-2 text-center px-4" style={{ background: 'var(--forest-mid)' }}>
        <Map className="w-8 h-8" style={{ color: 'var(--forest-rim)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--moss)' }}>
          Interactive map view — pins ranked locations with<br />Viability Scores overlaid
        </p>
        <p className="text-[9px]" style={{ color: 'var(--forest-rim)' }}>Map team integration pending</p>
      </div>
    </div>
  );
}

interface Props {
  backendOnline: boolean;
  financialReport: FinancialHealthReport | null;
  syncStatus?: SyncStatus;
}

export default function OptimizationTab({ backendOnline, financialReport, syncStatus }: Props) {
  const [selectedCities, setSelectedCities] = useState<string[]>(['Waterloo', 'Kitchener']);
  const [businessType, setBusinessType]     = useState('coffee shop');
  const [monthlyRent, setMonthlyRent]       = useState(3500);
  const [running, setRunning]               = useState(false);
  const [report, setReport]                 = useState<GeminiExpansionReport | null>(null);
  const [error, setError]                   = useState<string | null>(null);

  const toggleCity = (city: string) =>
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );

  const handleRun = async () => {
    if (!financialReport || selectedCities.length === 0 || !businessType.trim()) return;
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const locations: CandidateLocation[] = selectedCities.map((city) => ({
        lat: CITY_CONFIG[city].lat,
        lng: CITY_CONFIG[city].lng,
        city_name: city,
        business_type: businessType.trim(),
        monthly_rent: monthlyRent,
        census_division: CITY_CONFIG[city].census_division,
      }));
      const result = await optimizeLocations(financialReport, locations);
      setReport(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  if (!backendOnline) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)' }}>
          <Zap className="w-6 h-6" style={{ color: 'var(--moss)' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--forest)' }}>Expansion Optimizer</p>
        <p className="text-xs leading-relaxed max-w-[180px] mx-auto" style={{ color: 'var(--moss)' }}>
          Start the FastAPI backend to unlock location analysis.
        </p>
        <span className="text-[11px] px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600">
          Backend offline
        </span>
      </div>
    );
  }

  if (syncStatus === 'syncing' && !financialReport) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Zap className="w-8 h-8 animate-pulse" style={{ color: 'var(--sage)' }} />
        <p className="text-sm" style={{ color: 'var(--moss)' }}>Waiting for financial analysis…</p>
        <p className="text-[10px]" style={{ color: 'var(--moss)' }}>Your canvas nodes are being scored by the AI Accountant.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {!financialReport && (
        <div className="px-3 py-2.5 rounded-lg text-xs leading-relaxed" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)', color: 'var(--moss)' }}>
          Add nodes to the canvas — your financial profile will be analysed automatically, then used to score locations.
        </div>
      )}

      {/* City selection */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--moss)' }}>Target Cities</p>
        <div className="flex flex-wrap gap-1.5">
          {CITIES.map((city) => {
            const active = selectedCities.includes(city);
            return (
              <button
                key={city}
                onClick={() => toggleCity(city)}
                className="text-[11px] px-2.5 py-1 rounded-full border transition-colors"
                style={active
                  ? { background: 'var(--forest)', borderColor: 'var(--forest)', color: '#fff' }
                  : { background: 'var(--forest-mid)', borderColor: 'var(--forest-rim)', color: 'var(--moss)' }
                }
              >
                {city}
              </button>
            );
          })}
        </div>
      </div>

      {/* Business type */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--moss)' }}>
          Business Type
        </label>
        <input
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder="e.g. coffee shop, restaurant"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-colors"
          style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)', color: 'var(--forest)' }}
        />
      </div>

      {/* Monthly rent budget */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--moss)' }}>
          Monthly Rent Budget
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--moss)' }}>$</span>
          <input
            type="number"
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(Number(e.target.value))}
            min={500}
            step={100}
            className="w-full rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-1 transition-colors"
            style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)', color: 'var(--forest)' }}
          />
        </div>
        {financialReport && monthlyRent > financialReport.max_affordable_rent && (
          <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Exceeds BDC max affordable rent of {fmtCAD(financialReport.max_affordable_rent)}
          </p>
        )}
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || !financialReport || selectedCities.length === 0 || !businessType.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'var(--forest)' }}
      >
        {running ? (
          <><Zap className="w-4 h-4 animate-pulse" /> Analysing…</>
        ) : (
          <><TrendingUp className="w-4 h-4" /> Find Best Locations</>
        )}
      </button>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 flex gap-2 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <MapPlaceholder />

      {report && report.top_macro_risk && (
        <div className="px-3 py-2 rounded-lg text-xs flex gap-2 leading-relaxed" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)', color: 'var(--forest)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
          <span><span className="text-amber-600 font-semibold">Top macro risk: </span>{report.top_macro_risk}</span>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--moss)' }}>
            Expansion Analysis
          </p>

          {report.ranked_locations.length > 0 ? (
            <div className="space-y-2">
              {report.ranked_locations.map((loc, i) => (
                <LocationCard key={`${loc.city_name}-${i}`} loc={loc} rank={i} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg p-4 text-center space-y-2" style={{ background: 'var(--forest-mid)', border: '1px solid var(--forest-rim)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto" style={{ background: '#fff', border: '1px solid var(--forest-rim)' }}>
                <MapPin className="w-5 h-5" style={{ color: 'var(--moss)' }} />
              </div>
              <p className="text-xs font-medium" style={{ color: 'var(--forest)' }}>Location Analysis Pending</p>
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--moss)' }}>
                Detailed neighborhood rent and foot traffic scoring is currently
                being merged. Check back soon for localized data!
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
