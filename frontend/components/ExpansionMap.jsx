'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const DEFAULT_RECOMMENDATIONS = [
  {
    id: 1,
    name: 'Uptown Waterloo',
    latitude: 43.4668,
    longitude: -80.5224,
    opportunity_score: 87,
    estimated_rent: 3200,
    projected_profit_margin: 0.24,
  },
  {
    id: 2,
    name: 'Downtown Kitchener',
    latitude: 43.4516,
    longitude: -80.4925,
    opportunity_score: 72,
    estimated_rent: 2750,
    projected_profit_margin: 0.19,
  },
  {
    id: 3,
    name: 'University Ave Plaza',
    latitude: 43.4723,
    longitude: -80.5449,
    opportunity_score: 91,
    estimated_rent: 3800,
    projected_profit_margin: 0.28,
  },
  {
    id: 4,
    name: 'Laurelwood District',
    latitude: 43.4455,
    longitude: -80.5612,
    opportunity_score: 45,
    estimated_rent: 2100,
    projected_profit_margin: 0.14,
  },
];

function getRecommendationReason(rec) {
  if (rec.opportunity_score >= 75) {
    return 'High foot traffic area with strong consumer demand and favorable rent-to-revenue ratio.';
  } else if (rec.opportunity_score >= 50) {
    return 'Moderate opportunity with growing local market. Competitive rent supports healthy margins.';
  } else {
    return 'Higher competition zone. Strong brand differentiation recommended before entering.';
  }
}

function getMarkerColor(score) {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#eab308';
  return '#ef4444';
}

function getMarkerRgba(score, alpha) {
  if (score >= 75) return `rgba(34,197,94,${alpha})`;
  if (score >= 50) return `rgba(234,179,8,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
}

let stylesInjected = false;

function injectStyles() {
  if (typeof window === 'undefined' || stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse-ring-green {
      0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
      70%  { transform: scale(1);    box-shadow: 0 0 0 10px rgba(34,197,94,0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34,197,94,0); }
    }
    @keyframes pulse-ring-yellow {
      0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(234,179,8,0.6); }
      70%  { transform: scale(1);    box-shadow: 0 0 0 10px rgba(234,179,8,0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(234,179,8,0); }
    }
    @keyframes pulse-ring-red {
      0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
      70%  { transform: scale(1);    box-shadow: 0 0 0 10px rgba(239,68,68,0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    }
    .expansion-popup .mapboxgl-popup-content {
      background: #0f172a !important;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 0;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    }
    .expansion-popup .mapboxgl-popup-tip {
      border-top-color: #0f172a !important;
    }
  `;
  document.head.appendChild(style);
}

function getPulseAnimation(score) {
  if (score >= 75) return 'pulse-ring-green 2s cubic-bezier(0.4,0,0.6,1) infinite';
  if (score >= 50) return 'pulse-ring-yellow 2s cubic-bezier(0.4,0,0.6,1) infinite';
  return 'pulse-ring-red 2s cubic-bezier(0.4,0,0.6,1) infinite';
}

function createMarkerElement(rec) {
  const color = getMarkerColor(rec.opportunity_score);
  const glowRgba = getMarkerRgba(rec.opportunity_score, 0.35);

  const el = document.createElement('div');
  el.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: ${color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 13px;
    color: #0f172a;
    cursor: pointer;
    box-shadow: 0 0 12px 4px ${glowRgba};
    animation: ${getPulseAnimation(rec.opportunity_score)};
    border: 2px solid rgba(255,255,255,0.25);
    font-family: 'Inter', system-ui, sans-serif;
  `;
  el.textContent = rec.opportunity_score;
  return el;
}

export default function ExpansionMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [recommendations, setRecommendations] = useState(DEFAULT_RECOMMENDATIONS);
  const [heatmapVisible, setHeatmapVisible] = useState(true);
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    injectStyles();

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-80.5204, 43.4643],
      zoom: 13,
      pitch: 55,
      bearing: -17.6,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('load', () => {
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout['text-field']
      )?.id;

      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': '#1a1a2e',
            'fill-extrusion-height': [
              'interpolate', ['linear'], ['zoom'],
              15, 0,
              15.05, ['get', 'height'],
            ],
            'fill-extrusion-base': [
              'interpolate', ['linear'], ['zoom'],
              15, 0,
              15.05, ['get', 'min_height'],
            ],
            'fill-extrusion-opacity': 0.85,
          },
        },
        labelLayerId
      );
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof window === 'undefined') return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    function addMarkersAndHeatmap() {
      if (map.getSource('recommendations-heat')) {
        map.removeLayer('recommendations-heatmap');
        map.removeSource('recommendations-heat');
      }

      recommendations.forEach((rec) => {
        const el = createMarkerElement(rec);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          new mapboxgl.Popup({ offset: 25, className: 'expansion-popup' })
            .setLngLat([rec.longitude, rec.latitude])
            .setHTML(
              `<div style="font-family: 'Inter', sans-serif; padding: 12px; min-width: 220px; background: #0f172a; border-radius: 10px; color: #f1f5f9;">
                <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: #f8fafc;">${rec.name}</h3>
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
                  <div>🎯 <strong>Opportunity Score:</strong> <span style="color: ${getMarkerColor(rec.opportunity_score)}; font-weight: 700;">${rec.opportunity_score}/100</span></div>
                  <div>🏠 <strong>Est. Monthly Rent:</strong> $${rec.estimated_rent.toLocaleString()}</div>
                  <div>📈 <strong>Projected Margin:</strong> ${(rec.projected_profit_margin * 100).toFixed(1)}%</div>
                </div>
                <p style="margin: 10px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  ${getRecommendationReason(rec)}
                </p>
              </div>`
            )
            .addTo(map);
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([rec.longitude, rec.latitude])
          .addTo(map);

        markersRef.current.push(marker);
      });

      map.addSource('recommendations-heat', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: recommendations.map((r) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
            properties: { score: r.opportunity_score },
          })),
        },
      });

      map.addLayer({
        id: 'recommendations-heatmap',
        type: 'heatmap',
        source: 'recommendations-heat',
        maxzoom: 15,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'score'], 0, 0, 100, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(239,68,68,0.6)',
            0.5, 'rgba(234,179,8,0.7)',
            1, 'rgba(34,197,94,0.9)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 20, 15, 60],
          'heatmap-opacity': 0.6,
        },
      });
    }

    if (map.isStyleLoaded()) {
      addMarkersAndHeatmap();
    } else {
      map.once('load', addMarkersAndHeatmap);
    }
  }, [recommendations]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapRef.current.getLayer('recommendations-heatmap')) {
      mapRef.current.setLayoutProperty(
        'recommendations-heatmap',
        'visibility',
        heatmapVisible ? 'visible' : 'none'
      );
    }
  }, [heatmapVisible]);

  const handleAutoFill = () => {
    setBusinessType('Café / Coffee Shop');
    setLocation('Waterloo, ON');
    setBudget(4500);
    setAutoFilled(true);
    setTimeout(() => setAutoFilled(false), 3000);
  };

  const handleSearch = () => {
    if (!businessType) {
      setSearchError('Please select a business type.');
      return;
    }
    if (!location.trim()) {
      setSearchError('Please enter a target location.');
      return;
    }
    setSearchError('');
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none">
      {/* Mapbox container — fullscreen base layer */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0 pointer-events-auto" />

      {/* Search Panel — top left */}
      <div className="absolute top-20 left-4 z-10 w-80 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-5 pointer-events-auto">
        <h2 className="text-white font-bold text-base mb-4 tracking-wide">
          🔍 Find Expansion Locations
        </h2>

        {/* Business Type */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-400 mb-1">Business Type</label>
          <select
            value={businessType}
            onChange={(e) => { setBusinessType(e.target.value); setSearchError(''); }}
            className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
          >
            <option value="" disabled>Select type...</option>
            <option>Retail Store</option>
            <option>Café / Coffee Shop</option>
            <option>Restaurant</option>
            <option>Fitness Studio</option>
            <option>Salon &amp; Spa</option>
            <option>Medical / Dental Clinic</option>
            <option>Co-working Space</option>
            <option>Grocery / Convenience</option>
            <option>Boutique Hotel</option>
            <option>Other</option>
          </select>
        </div>

        {/* Location */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-400 mb-1">Target City or Region</label>
          <input
            type="text"
            value={location}
            onChange={(e) => { setLocation(e.target.value); setSearchError(''); }}
            placeholder="e.g. Waterloo, ON"
            className="w-full bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
          />
        </div>

        {/* Auto-Fill */}
        <div className="mb-3">
          <button
            onClick={handleAutoFill}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-blue-500/60 bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-all duration-200"
          >
            ⚡ Auto-Fill with My Finances
          </button>
          {autoFilled && (
            <p className="text-xs text-blue-400 text-center mt-1 animate-pulse">
              ✓ Filled from your Financial Sandbox
            </p>
          )}
        </div>

        {/* Budget */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-400 mb-1">Max Monthly Rent Budget</label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 4500"
              className="w-full bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
            />
          </div>
        </div>

        {/* Validation error */}
        {searchError && (
          <p className="text-xs text-red-400 mb-2">{searchError}</p>
        )}

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="w-full py-2.5 rounded-lg bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
        >
          {isSearching ? 'Searching...' : '🚀 Find Best Locations'}
        </button>
      </div>

      {/* Legend — bottom left */}
      <div className="absolute bottom-6 left-4 z-10 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl p-3 text-xs text-slate-300 pointer-events-auto">
        <div className="font-semibold text-white mb-2">Opportunity Score</div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> High (75–100)
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Medium (50–74)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Low (0–49)
        </div>
      </div>

      {/* Heatmap Toggle — bottom right */}
      <button
        onClick={() => setHeatmapVisible((prev) => !prev)}
        className={`absolute bottom-20 right-6 z-10 pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-xl border transition-all duration-200 ${
          heatmapVisible
            ? 'bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500/30'
            : 'bg-slate-800/90 border-slate-600 text-slate-400 hover:bg-slate-700'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${heatmapVisible ? 'bg-green-400' : 'bg-slate-500'}`} />
        {heatmapVisible ? 'Heatmap On' : 'Heatmap Off'}
      </button>
    </div>
  );
}
