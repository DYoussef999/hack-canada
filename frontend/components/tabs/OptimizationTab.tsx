'use client';

import { useState } from 'react';
import { Zap, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { optimizeExpansion } from '@/services/compassApi';
import type { LocationResult } from '@/types/api';

const ONTARIO_CITIES = ['Toronto', 'Ottawa', 'Hamilton', 'London', 'Kitchener', 'Waterloo', 'Mississauga', 'Brampton'];

const fmtCAD = (v: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v);

function ViabilityBadge({ score }: { score: number }) {
  // Backend returns 0–100; clamp for safety
  const pct = Math.min(100, Math.round(score));
  const color = pct >= 70 ? 'text-green-400 bg-green-950 border-green-800'
              : pct >= 40 ? 'text-yellow-400 bg-yellow-950 border-yellow-800'
              : 'text-red-400 bg-red-950 border-red-800';
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold tabular-nums ${color}`}>
      {pct}%
    </span>
  );
}

function LocationCard({ loc }: { loc: LocationResult }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="text-xs font-semibold text-zinc-200">{loc.neighbourhood}</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">{loc.city}</p>
        </div>
        <ViabilityBadge score={loc.viability_score} />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Est. Rent</span>
        <span className="text-zinc-300 tabular-nums font-medium">{fmtCAD(loc.monthly_rent)}/mo</span>
      </div>

      <p className="text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-800 pt-2">{loc.rationale}</p>

      {loc.risk_flag && (
        <div className="flex items-start gap-1.5 text-[10px] text-yellow-400">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{loc.risk_flag}</span>
        </div>
      )}
    </div>
  );
}

interface Props {
  sessionId: string | null;
  backendOnline: boolean;
}

export default function OptimizationTab({ sessionId, backendOnline }: Props) {
  const [selectedCities, setSelectedCities] = useState<string[]>(['Waterloo', 'Kitchener']);
  const [businessType, setBusinessType]     = useState('coffee shop');
  const [deepAnalysis, setDeepAnalysis]     = useState(false);
  const [running, setRunning]               = useState(false);
  const [results, setResults]               = useState<LocationResult[] | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);

  const toggleCity = (city: string) =>
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );

  const handleRun = async () => {
    if (!sessionId || selectedCities.length === 0 || !businessType.trim()) return;
    setRunning(true);
    setError(null);
    setResults(null);
    setRecommendation(null);
    try {
      const res = await optimizeExpansion(sessionId, selectedCities, businessType.trim(), deepAnalysis);
      const locations = res.result?.locations ?? [];
      setResults(locations);
      setRecommendation(res.result?.recommendation ?? null);
      if (locations.length === 0) {
        setError('No locations returned — the agent may have had trouble parsing results. Try again or check the backend logs.');
      }
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
        <div>
          <p className="text-sm font-semibold text-zinc-300">Expansion Optimizer</p>
          <p className="text-xs text-zinc-600 mt-2 leading-relaxed max-w-[180px] mx-auto">
            Start the FastAPI backend to unlock location analysis.
          </p>
        </div>
        <span className="text-[11px] px-3 py-1 rounded-full bg-red-950 border border-red-800 text-red-400">
          Backend offline
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* City chips */}
      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Target Cities</p>
        <div className="flex flex-wrap gap-1.5">
          {ONTARIO_CITIES.map((city) => {
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

      {/* Deep analysis toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setDeepAnalysis((d) => !d)}
          className={`relative w-9 h-5 rounded-full transition-colors ${deepAnalysis ? 'bg-blue-600' : 'bg-zinc-700'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${deepAnalysis ? 'translate-x-4' : ''}`}
          />
        </div>
        <div>
          <p className="text-xs text-zinc-300">Deep Analysis</p>
          <p className="text-[10px] text-zinc-600">Uses Claude claude-sonnet-4-6 for richer narrative</p>
        </div>
      </label>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || selectedCities.length === 0 || !businessType.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-semibold text-white"
      >
        {running ? (
          <>
            <Zap className="w-4 h-4 animate-pulse" /> Analysing…
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" /> Analyse Locations
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-950/50 border border-red-800 text-xs text-red-400 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Recommendation banner */}
      {recommendation && (
        <div className="px-3 py-2 rounded-lg bg-green-950/40 border border-green-800/60 text-xs text-green-300 flex gap-2 leading-relaxed">
          <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-400" />
          {recommendation}
        </div>
      )}

      {/* Location cards */}
      {results && results.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5">
            Ranked Locations
          </p>
          <div className="space-y-3">
            {results.map((loc, i) => (
              <LocationCard key={`${loc.city}-${loc.neighbourhood}-${i}`} loc={loc} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
