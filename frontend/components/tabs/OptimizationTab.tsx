'use client';

import { useState } from 'react';
import { Zap, MapPin, AlertTriangle, ChevronUp, ChevronDown, Map, Shield, TrendingUp } from 'lucide-react';
import { optimizeLocations, type CandidateLocation } from '@/services/compassApi';
import type { FinancialHealthReport, GeminiExpansionReport, RankedLocation, SyncStatus } from '@/types/api';

const fmtCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v);

// City → geo + census division mapping
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
  const color = pct >= 65 ? 'text-emerald-400 border-emerald-800 bg-emerald-950/40'
              : pct >= 40 ? 'text-amber-400 border-amber-800 bg-amber-950/40'
              : 'text-rose-400 border-rose-800 bg-rose-950/40';
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
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/20 overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-zinc-800/40 transition-colors"
      >
        <span className="text-[10px] font-black text-zinc-600 w-4 shrink-0">#{rank + 1}</span>
        <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
        <span className="text-xs font-semibold text-zinc-200 flex-1 truncate">{loc.city_name}</span>
        <span className="text-[10px] text-zinc-500 tabular-nums">{fmtCAD(loc.monthly_rent)}/mo</span>
        <VeScore score={loc.viability_score.computed_score} />
        {expanded ? <ChevronUp className="w-3 h-3 text-zinc-600" /> : <ChevronDown className="w-3 h-3 text-zinc-600" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-zinc-800/60 pt-2.5">
          {loc.recommendation && (
            <p className="text-[11px] text-zinc-400 leading-relaxed">{loc.recommendation}</p>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-zinc-800/40 rounded p-2">
              <p className="text-[9px] text-zinc-600 mb-0.5">Ve Score Formula</p>
              <p className="text-[10px] text-zinc-400 font-mono">
                ({fmtCAD(Math.round(loc.viability_score.p_rev))} × {(loc.viability_score.d_demographic * 100).toFixed(0)}%)
                <br />÷ (rent × comp + fixed)
              </p>
            </div>
            <div className="bg-zinc-800/40 rounded p-2">
              <p className="text-[9px] text-zinc-600 mb-0.5">SME Score</p>
              <p className="text-xs font-bold text-zinc-200">{(loc.viability_score.d_demographic * 100).toFixed(0)}/100</p>
              <p className="text-[9px] text-zinc-600">Competition: {(loc.viability_score.s_competition * 100).toFixed(0)}/100</p>
            </div>
          </div>

          {loc.macro_risk_flag && (
            <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-amber-950/30 border border-amber-900/40">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-300 leading-relaxed">{loc.macro_risk_flag}</p>
            </div>
          )}

          {loc.vulnerability_note && (
            <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/40">
              <Shield className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-zinc-500 leading-relaxed">{loc.vulnerability_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Map placeholder — ready for the map team to drop their component in
function MapPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-700 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800/60 flex items-center gap-1.5">
        <Map className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Location Map</span>
        <span className="ml-auto text-[9px] px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500">
          Coming soon
        </span>
      </div>
      {/*
        ── MAP INTEGRATION POINT ──────────────────────────────────────────────────
        Replace the placeholder below with your map component.
        Props available: rankedLocations (RankedLocation[]) with lat/lng/city_name/viability_score
        Example: <YourMapComponent locations={report?.ranked_locations ?? []} />
      */}
      <div className="h-44 bg-zinc-900/60 flex flex-col items-center justify-center gap-2 text-center px-4">
        <Map className="w-8 h-8 text-zinc-700" />
        <p className="text-xs text-zinc-600 leading-relaxed">
          Interactive map view — pins ranked locations with<br />Viability Scores overlaid
        </p>
        <p className="text-[9px] text-zinc-700">Map team integration pending</p>
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
        <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <Zap className="w-6 h-6 text-zinc-500" />
        </div>
        <p className="text-sm font-semibold text-zinc-300">Expansion Optimizer</p>
        <p className="text-xs text-zinc-600 leading-relaxed max-w-[180px] mx-auto">
          Start the FastAPI backend to unlock location analysis.
        </p>
        <span className="text-[11px] px-3 py-1 rounded-full bg-red-950 border border-red-800 text-red-400">
          Backend offline
        </span>
      </div>
    );
  }

  if (syncStatus === 'syncing' && !financialReport) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Zap className="w-8 h-8 text-blue-500 animate-pulse" />
        <p className="text-sm text-zinc-400">Waiting for financial analysis…</p>
        <p className="text-[10px] text-zinc-600">Your canvas nodes are being scored by the AI Accountant.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {/* Canvas sync notice */}
      {!financialReport && (
        <div className="px-3 py-2.5 rounded-lg bg-zinc-800/60 border border-zinc-700 text-xs text-zinc-500 leading-relaxed">
          Add nodes to the canvas — your financial profile will be analysed automatically, then used to score locations.
        </div>
      )}

      {/* City selection */}
      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Target Cities</p>
        <div className="flex flex-wrap gap-1.5">
          {CITIES.map((city) => {
            const active = selectedCities.includes(city);
            return (
              <button
                key={city}
                onClick={() => toggleCity(city)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {city}
              </button>
            );
          })}
        </div>
      </div>

      {/* Business type */}
      <div>
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">
          Business Type
        </label>
        <input
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder="e.g. coffee shop, restaurant"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition-colors"
        />
      </div>

      {/* Monthly rent budget */}
      <div>
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">
          Monthly Rent Budget
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
          <input
            type="number"
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(Number(e.target.value))}
            min={500}
            step={100}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-600 transition-colors"
          />
        </div>
        {financialReport && monthlyRent > financialReport.max_affordable_rent && (
          <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Exceeds BDC max affordable rent of {fmtCAD(financialReport.max_affordable_rent)}
          </p>
        )}
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || !financialReport || selectedCities.length === 0 || !businessType.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-semibold text-white"
      >
        {running ? (
          <><Zap className="w-4 h-4 animate-pulse" /> Analysing…</>
        ) : (
          <><TrendingUp className="w-4 h-4" /> Find Best Locations</>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-950/50 border border-red-800 text-xs text-red-400 flex gap-2 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Map placeholder — always visible, pins populate after analysis */}
      <MapPlaceholder />

      {/* Top macro risk banner */}
      {report && report.top_macro_risk && (
        <div className="px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 text-xs text-zinc-400 flex gap-2 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span><span className="text-amber-400 font-semibold">Top macro risk: </span>{report.top_macro_risk}</span>
        </div>
      )}

      {/* Ranked location cards */}
      {report && (
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
            Expansion Analysis
          </p>
          
          {report.ranked_locations.length > 0 ? (
            <div className="space-y-2">
              {report.ranked_locations.map((loc, i) => (
                <LocationCard key={`${loc.city_name}-${i}`} loc={loc} rank={i} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-zinc-900/40 border border-zinc-800 p-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto">
                <MapPin className="w-5 h-5 text-zinc-600" />
              </div>
              <p className="text-xs text-zinc-400 font-medium">Location Analysis Pending</p>
              <p className="text-[10px] text-zinc-600 leading-relaxed">
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
