'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const DEFAULT_RECOMMENDATIONS = [
  {
    id: 1, name: 'Uptown Waterloo', latitude: 43.4668, longitude: -80.5224,
    opportunity_score: 87, estimated_rent: 3200, projected_profit_margin: 0.24,
    address: '99 Regina St N, Waterloo, ON',
    hourly: [5,5,5,5,5,5,10,20,35,45,55,65,70,65,60,65,70,80,90,85,75,60,40,15],
  },
  {
    id: 2, name: 'Downtown Kitchener', latitude: 43.4516, longitude: -80.4925,
    opportunity_score: 72, estimated_rent: 2750, projected_profit_margin: 0.19,
    address: '305 King St W, Kitchener, ON',
    hourly: [5,5,5,5,5,10,20,45,70,75,70,65,60,65,70,65,60,55,50,45,35,25,15,8],
  },
  {
    id: 3, name: 'University Ave Plaza', latitude: 43.4723, longitude: -80.5449,
    opportunity_score: 91, estimated_rent: 3800, projected_profit_margin: 0.28,
    address: '550 University Ave W, Waterloo, ON',
    hourly: [10,8,15,5,10,30,65,80,75,70,60,55,50,60,70,65,55,50,45,40,35,30,20,10],
  },
  {
    id: 4, name: 'Laurelwood District', latitude: 43.4455, longitude: -80.5612,
    opportunity_score: 45, estimated_rent: 2100, projected_profit_margin: 0.14,
    address: '450 Erb St W, Waterloo, ON',
    hourly: [2,2,2,2,2,5,10,20,30,40,50,55,60,55,50,45,40,35,30,20,15,10,5,2],
  },
];

const HOURS = ['12a','1a','2a','3a','4a','5a','6a','7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p','11p'];
const BUILDING_SIZE = 0.00022;

// ── Score color helpers (5-bucket) ────────────────────────────────────────────
function getScoreColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#a3e635';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function getScoreBg(score) {
  if (score >= 80) return 'rgba(34,197,94,0.18)';
  if (score >= 60) return 'rgba(163,230,53,0.18)';
  if (score >= 40) return 'rgba(234,179,8,0.18)';
  if (score >= 20) return 'rgba(249,115,22,0.18)';
  return 'rgba(239,68,68,0.18)';
}

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Very Low';
}

// 5-tier traffic intensity: Very High → red, High → orange, Medium → yellow, Low → green, Very Low → blue-grey
function getFootColor(busyness) {
  if (busyness >= 80) return '#ef4444'; // Very High
  if (busyness >= 60) return '#f97316'; // High
  if (busyness >= 40) return '#eab308'; // Medium
  if (busyness >= 20) return '#22c55e'; // Low
  return '#94a3b8';                     // Very Low
}

function getTrafficLabel(busyness) {
  if (busyness >= 80) return 'Very High';
  if (busyness >= 60) return 'High';
  if (busyness >= 40) return 'Medium';
  if (busyness >= 20) return 'Low';
  return 'Very Low';
}

// ── Foot traffic API ──────────────────────────────────────────────────────────
/**
 * Single entry point for all foot traffic data fetching.
 * Designed to support both on-load initialisation and future search-triggered calls
 * by accepting an optional location hint (area/city string) for dynamic lookups.
 *
 * @param {string} [locationHint] - Optional area for search-driven calls (future use)
 * @returns {{ locations: Array, source: 'live'|'fallback' }}
 */
async function fetchFootTrafficData(locationHint) {
  try {
    const body = locationHint ? { location: locationHint } : {};
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/locations/search`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'ok' && data.locations?.length) {
      return { locations: data.locations, source: data.data_source || 'live' };
    }
    throw new Error('Invalid response shape');
  } catch (err) {
    console.warn('BestTime API unavailable — using fallback traffic data', err);
    return { locations: DEFAULT_RECOMMENDATIONS, source: 'fallback' };
  }
}

function getProsCons(rec) {
  const pros = [];
  const cons = [];
  if (rec.opportunity_score >= 80) pros.push('Exceptional location score');
  else if (rec.opportunity_score >= 60) pros.push('Strong location score');
  else if (rec.opportunity_score >= 40) pros.push('Moderate location appeal');
  else cons.push('Below-average location score');

  if (rec.projected_profit_margin >= 0.25) pros.push('High profit margin');
  else if (rec.projected_profit_margin >= 0.18) pros.push('Healthy profit margin');
  else cons.push('Slim profit margin');

  if (rec.estimated_rent <= 2500) pros.push('Affordable rent');
  else if (rec.estimated_rent >= 3500) cons.push('Higher rent commitment');

  const peakTraffic = Math.max(...rec.hourly);
  if (peakTraffic >= 75) pros.push('Strong foot traffic');
  else if (peakTraffic >= 50) pros.push('Moderate foot traffic');
  else cons.push('Limited foot traffic');

  return { pros, cons };
}

// ── Map geometry helpers ───────────────────────────────────────────────────────
function buildingSquare(lng, lat, size = BUILDING_SIZE) {
  return [
    [lng - size, lat - size],
    [lng + size, lat - size],
    [lng + size, lat + size],
    [lng - size, lat + size],
    [lng - size, lat - size],
  ];
}

function emptyGeoJSON() {
  return { type: 'FeatureCollection', features: [] };
}

function bufferPolygon(geometry, amount = 0.000015) {
  const expandRing = (ring) => {
    const cx = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const cy = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    return ring.map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [x + (dx / len) * amount, y + (dy / len) * amount];
    });
  };
  if (geometry.type === 'Polygon') return { ...geometry, coordinates: geometry.coordinates.map(expandRing) };
  if (geometry.type === 'MultiPolygon') return { ...geometry, coordinates: geometry.coordinates.map((p) => p.map(expandRing)) };
  return geometry;
}

function buildFromRealFeature(feature, height) {
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { height }, geometry: bufferPolygon(feature.geometry) }],
  };
}

function buildFallbackGeoJSON(rec) {
  if (!rec) return emptyGeoJSON();
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { height: 30 + rec.opportunity_score * 0.5 },
      geometry: { type: 'Polygon', coordinates: [buildingSquare(rec.longitude, rec.latitude)] },
    }],
  };
}

function buildHeatGeoJSON(recs, hour) {
  return {
    type: 'FeatureCollection',
    features: recs.map((rec) => ({
      type: 'Feature',
      properties: { intensity: rec.hourly[hour] / 100 },
      geometry: { type: 'Point', coordinates: [rec.longitude, rec.latitude] },
    })),
  };
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ score, color }) {
  const r = 34;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;
  const prosLength = (score / 100) * circumference;
  return (
    <svg viewBox="0 0 100 100" width={110} height={110}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e0dbd3" strokeWidth={13} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={13}
        strokeDasharray={`${prosLength} ${circumference - prosLength}`}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      <text x="50" y="45" textAnchor="middle" fontSize="19" fontWeight="700" fill={color}
        style={{ fontFamily: 'Inter,sans-serif' }}>{score}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="9" fill="#3e6b2a"
        style={{ fontFamily: 'Inter,sans-serif' }}>/100</text>
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
let stylesInjected = false;
function injectStyles() {
  if (typeof window === 'undefined' || stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .loc-card:hover { background: rgba(26,46,18,0.04) !important; }
    @keyframes slideInRight {
      from { transform: translateX(110%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes spinLoader {
      to { transform: rotate(360deg); }
    }
    .info-panel-enter { animation: slideInRight 0.38s cubic-bezier(0.34,1.4,0.64,1) forwards; }
    .spin-loader { animation: spinLoader 0.85s linear infinite; }
  `;
  document.head.appendChild(style);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExpansionMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const moveEndRef = useRef(null);

  const [recommendations, setRecommendations] = useState(DEFAULT_RECOMMENDATIONS);
  const [trafficDataSource, setTrafficDataSource] = useState('loading');
  const [selectedId, setSelectedId] = useState(null);
  const [heatmapVisible, setHeatmapVisible] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef(null);

  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showSearch, setShowSearch] = useState(true);
  const [searchCompleted, setSearchCompleted] = useState(false);

  const selectedRec = recommendations.find((r) => r.id === selectedId) || null;

  // ── Load live foot traffic on mount ───────────────────────────────────────
  useEffect(() => {
    fetchFootTrafficData().then(({ locations, source }) => {
      setRecommendations(locations);
      setTrafficDataSource(source);
      if (source === 'live') console.log('✓ BestTime API: live foot traffic data loaded');
    });
  }, []);

  // ── Init Map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    injectStyles();
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-80.5004, 43.4600],
      zoom: 12,
      pitch: 30,
      bearing: -10,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('load', () => {
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find((l) => l.type === 'symbol' && l.layout['text-field'])?.id;

      map.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 12,
        paint: {
          'fill-extrusion-color': '#d1cec8',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
          'fill-extrusion-opacity': 0.85,
        },
      }, labelLayerId);

      map.addSource('foot-heat', {
        type: 'geojson',
        data: buildHeatGeoJSON(DEFAULT_RECOMMENDATIONS, new Date().getHours()),
      });
      map.addLayer({
        id: 'foot-heat-layer',
        type: 'heatmap',
        source: 'foot-heat',
        maxzoom: 22,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 17, 2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 20, 13, 40, 15, 25, 17, 18, 19, 14],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 15, 0.7, 19, 0.8],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(148,163,184,0)', // Very Low - transparent
            0.2, '#94a3b8',             // Very Low - blue-grey
            0.4, '#22c55e',             // Low - green
            0.6, '#eab308',             // Medium - yellow
            0.8, '#f97316',             // High - orange
            1.0, '#ef4444',             // Very High - red
          ],
        },
      });

      map.addSource('selected-building', { type: 'geojson', data: emptyGeoJSON() });
      map.addLayer({
        id: 'selected-extrusion',
        type: 'fill-extrusion',
        source: 'selected-building',
        paint: {
          'fill-extrusion-color': '#22c55e',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.82,
        },
      });
      map.addLayer({
        id: 'selected-outline',
        type: 'line',
        source: 'selected-building',
        paint: { 'line-color': '#22c55e', 'line-width': 2.5, 'line-opacity': 0.9 },
      });
    });

    mapRef.current = map;
    return () => { map.remove(); };
  }, []);

  // ── Selected location: fly + color + building outline ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('selected-building');
    if (!src) return;

    if (moveEndRef.current) { map.off('moveend', moveEndRef.current); moveEndRef.current = null; }

    if (!selectedRec) { src.setData(emptyGeoJSON()); return; }

    // Update extrusion + outline color to match rating
    const ratingColor = getScoreColor(selectedRec.opportunity_score);
    if (map.getLayer('selected-extrusion')) map.setPaintProperty('selected-extrusion', 'fill-extrusion-color', ratingColor);
    if (map.getLayer('selected-outline')) map.setPaintProperty('selected-outline', 'line-color', ratingColor);

    map.flyTo({ center: [selectedRec.longitude, selectedRec.latitude], zoom: 17, pitch: 58, bearing: -18, duration: 1800, essential: true });

    const recSnapshot = selectedRec;
    const onMoveEnd = () => {
      if (moveEndRef.current !== onMoveEnd) return;
      moveEndRef.current = null;

      const point = map.project([recSnapshot.longitude, recSnapshot.latitude]);
      const bbox = [[point.x - 20, point.y - 20], [point.x + 20, point.y + 20]];
      const buildings = map.queryRenderedFeatures(bbox, { layers: ['3d-buildings'] });

      if (buildings.length > 0) {
        const closest = buildings.reduce((best, f) => {
          if (!f.geometry) return best;
          const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
          const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
          const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
          const dist = Math.hypot(cx - recSnapshot.longitude, cy - recSnapshot.latitude);
          return !best || dist < best.dist ? { f, dist } : best;
        }, null);
        const osmHeight = (closest.f.properties?.height || closest.f.properties?.render_height || 12) * 1.4;
        src.setData(buildFromRealFeature(closest.f, osmHeight));
      } else {
        src.setData(buildFallbackGeoJSON(recSnapshot));
      }
    };

    moveEndRef.current = onMoveEnd;
    map.on('moveend', onMoveEnd);
  }, [selectedId]);

  // ── Heatmap hour update ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('foot-heat');
    if (src) src.setData(buildHeatGeoJSON(recommendations, currentHour));
  }, [currentHour]);

  // ── Heatmap toggle ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('foot-heat-layer')) return;
    map.setLayoutProperty('foot-heat-layer', 'visibility', heatmapVisible ? 'visible' : 'none');
  }, [heatmapVisible]);

  // ── Play animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) { playRef.current = setInterval(() => setCurrentHour((h) => (h + 1) % 24), 800); }
    else { clearInterval(playRef.current); }
    return () => clearInterval(playRef.current);
  }, [isPlaying]);

  const handleAutoFill = () => {
    setBusinessType('Café / Coffee Shop');
    setLocation('Waterloo, ON');
    setBudget(4500);
    setAutoFilled(true);
    setTimeout(() => setAutoFilled(false), 3000);
  };

  const handleSearch = async () => {
    if (!businessType) { setSearchError('Please select a business type.'); return; }
    if (!location.trim()) { setSearchError('Please enter a target location.'); return; }
    setSearchError('');
    setIsSearching(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/locations/search`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business_type: businessType, location, budget: budget ? parseFloat(budget) : null }) }
      );
      const data = await res.json();
      if (data.status === 'ok' && data.locations?.length) {
        setRecommendations(data.locations);
        setSelectedId(null);
      } else {
        setSearchError('No locations found. Try adjusting your budget.');
      }
    } catch (err) {
      console.error('Search failed:', err);
      setSearchError('Could not reach backend. Using demo data.');
      setRecommendations(DEFAULT_RECOMMENDATIONS);
    } finally {
      setIsSearching(false);
      setSearchCompleted(true);
      setShowSearch(false);
    }
  };

  const infoPanelData = selectedRec ? getProsCons(selectedRec) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none">

      {/* Map */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0 pointer-events-auto" />

      {/* ── Left Sidebar ── */}
      <div className="absolute top-16 left-0 bottom-0 w-80 z-10 flex flex-col pointer-events-auto"
        style={{ background: 'rgba(232,227,219,0.97)', borderRight: '1px solid #ddd8cf' }}>

        {/* Search panel */}
        {showSearch ? (
          <div className="p-4" style={{ borderBottom: '1px solid #ddd8cf' }}>
            <h2 className="font-bold text-sm mb-3 tracking-wide" style={{ color: '#1a2e12' }}>🔍 Find Expansion Locations</h2>
            <div className="mb-2">
              <select value={businessType} onChange={(e) => { setBusinessType(e.target.value); setSearchError(''); }}
                className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none transition"
                style={{ background: '#fff', border: '1px solid #ddd8cf', color: '#1a2e12' }}>
                <option value="" disabled>Business type...</option>
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
            <div className="mb-2">
              <input type="text" value={location} onChange={(e) => { setLocation(e.target.value); setSearchError(''); }}
                placeholder="Target city or region..."
                className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none transition"
                style={{ background: '#fff', border: '1px solid #ddd8cf', color: '#1a2e12' }} />
            </div>
            <div className="mb-2 flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2 text-xs" style={{ color: '#3e6b2a' }}>$</span>
                <input type="number" value={budget || ''} onChange={(e) => setBudget(e.target.value)}
                  placeholder="Max rent/mo"
                  className="w-full rounded-lg pl-6 pr-2 py-2 text-xs focus:outline-none transition"
                  style={{ background: '#fff', border: '1px solid #ddd8cf', color: '#1a2e12' }} />
              </div>
              <button onClick={handleAutoFill}
                className="px-2 py-2 rounded-lg text-xs transition whitespace-nowrap"
                style={{ border: '1px solid #ddd8cf', background: '#f0f7ee', color: '#1a2e12' }}>
                ⚡ Auto
              </button>
            </div>
            {autoFilled && <p className="text-xs mb-1 animate-pulse" style={{ color: '#3d8b24' }}>✓ Filled from Financial Sandbox</p>}
            {searchError && <p className="text-xs text-red-600 mb-1">{searchError}</p>}
            <button onClick={handleSearch} disabled={isSearching}
              className="w-full py-2 rounded-lg font-bold text-xs transition disabled:opacity-50"
              style={{ background: '#1a2e12', color: '#fff' }}>
              {isSearching ? 'Searching...' : '🚀 Find Best Locations'}
            </button>
          </div>
        ) : (
          <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid #ddd8cf' }}>
            <div>
              <div className="text-xs font-semibold" style={{ color: '#1a2e12' }}>{businessType || 'All types'} · {location || 'Waterloo'}</div>
              <div className="text-xs mt-0.5" style={{ color: '#3e6b2a' }}>{recommendations.length} locations found</div>
            </div>
            <button onClick={() => setShowSearch(true)}
              className="text-xs rounded px-2 py-1 transition"
              style={{ color: '#3e6b2a', border: '1px solid #ddd8cf' }}>
              Edit
            </button>
          </div>
        )}

        {/* Traffic data source status */}
        <div style={{ padding: '5px 14px 4px', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: trafficDataSource === 'live' ? '#22c55e' : trafficDataSource === 'loading' ? '#eab308' : '#94a3b8',
          }} />
          <span style={{ fontSize: 9, color: '#3e6b2a', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
            {trafficDataSource === 'live' ? 'LIVE TRAFFIC DATA' : trafficDataSource === 'loading' ? 'LOADING…' : 'SAMPLE DATA'}
          </span>
        </div>

        {/* Location cards list */}
        <div className="flex-1 overflow-y-auto relative" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ddd8cf transparent' }}>

          {(searchCompleted
            ? [...recommendations].sort((a, b) => b.opportunity_score - a.opportunity_score)
            : recommendations
          ).map((rec, idx) => {
              const busyness = rec.hourly[currentHour];
              const isActive = selectedId === rec.id;
              const scoreColor = getScoreColor(rec.opportunity_score);
              const scoreBg = getScoreBg(rec.opportunity_score);
              // Light colors (yellow-green, yellow) need dark badge text for contrast
              const badgeTextColor = (rec.opportunity_score >= 40 && rec.opportunity_score < 80) ? '#1a2e12' : '#fff';
              return (
                <div key={rec.id}
                  className="loc-card"
                  onClick={() => setSelectedId(isActive ? null : rec.id)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                    cursor: 'pointer',
                    background: (isActive && searchCompleted) ? scoreBg : 'transparent',
                    borderLeft: `3px solid ${(isActive && searchCompleted) ? scoreColor : 'transparent'}`,
                    transition: 'background 0.4s ease, border-color 0.4s ease',
                  }}>

                  {/* Row 1: rank + name + score badge (badge only after search) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#3e6b2a', fontFamily: 'monospace', minWidth: 14 }}>{idx + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1a2e12' }}>
                      {rec.name}
                    </span>
                    {searchCompleted && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: scoreColor, color: badgeTextColor,
                      }}>
                        {rec.opportunity_score}
                      </span>
                    )}
                  </div>

                  {/* Row 2: address */}
                  <div style={{ fontSize: 11, color: '#3e6b2a', marginBottom: 8, paddingLeft: 22 }}>{rec.address}</div>

                  {/* Row 3: stats */}
                  <div style={{ display: 'flex', gap: 10, paddingLeft: 22 }}>
                    <div style={{ fontSize: 11, color: '#3e6b2a' }}>
                      🏠 <span style={{ color: '#1a2e12' }}>${rec.estimated_rent.toLocaleString()}/mo</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#3e6b2a' }}>
                      📈 <span style={{ color: '#1a2e12' }}>{(rec.projected_profit_margin * 100).toFixed(0)}% margin</span>
                    </div>
                  </div>

                  {/* Row 4: foot traffic */}
                  <div style={{ paddingLeft: 22, marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#3e6b2a' }}>🚶 Foot traffic · {HOURS[currentHour]}</span>
                      <span style={{ fontSize: 10, color: getFootColor(busyness), fontWeight: 600 }}>{getTrafficLabel(busyness)}</span>
                    </div>
                    <div style={{ height: 4, background: '#ddd8cf', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${busyness}%`, background: getFootColor(busyness), borderRadius: 4, transition: 'width 0.4s, background 0.4s' }} />
                    </div>
                  </div>

                  {isActive && (
                    <div style={{ paddingLeft: 22, marginTop: 8, fontSize: 10, color: '#3e6b2a', opacity: 0.75 }}>
                      ↑ Viewing on map · click again to deselect
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Heatmap toggle */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid #ddd8cf' }}>
          <button onClick={() => setHeatmapVisible((prev) => !prev)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 8,
              background: heatmapVisible ? '#f0f7ee' : '#faf8f4',
              border: heatmapVisible ? '1px solid #3d8b24' : '1px solid #ddd8cf',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
            <span style={{ fontSize: 12, color: heatmapVisible ? '#1a2e12' : '#3e6b2a', fontWeight: 600 }}>🌡 Foot Traffic Heatmap</span>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
              background: heatmapVisible ? '#dcefd8' : '#f3f0eb',
              color: heatmapVisible ? '#3d8b24' : '#3e6b2a',
            }}>
              {heatmapVisible ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Right Info Panel ── */}
      {selectedRec && (
        <div key={selectedRec.id} className="pointer-events-auto"
          style={{ position: 'absolute', right: 16, top: 80, zIndex: 20 }}>
          <div className="info-panel-enter" style={{
            width: 292,
            maxHeight: 'calc(100vh - 220px)',
            background: 'rgba(232,227,219,0.98)',
            borderRadius: 24,
            border: '1px solid #ddd8cf',
            boxShadow: '0 24px 60px rgba(26,46,18,0.22)',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#ddd8cf transparent',
          }}>

            {/* Header */}
            <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #ddd8cf', position: 'relative' }}>
              <button onClick={() => setSelectedId(null)} style={{
                position: 'absolute', top: 14, right: 14,
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(26,46,18,0.07)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, color: '#3e6b2a', fontWeight: 700, lineHeight: 1,
              }}>×</button>
              <div style={{ fontSize: 10, color: '#3e6b2a', marginBottom: 4, letterSpacing: '0.08em' }}>EXPANSION OPPORTUNITY</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2e12', marginBottom: 4, paddingRight: 30 }}>{selectedRec.name}</div>
              <div style={{ fontSize: 11, color: '#3e6b2a' }}>{selectedRec.address}</div>
            </div>

            {/* Donut + score legend */}
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #ddd8cf', display: 'flex', alignItems: 'center', gap: 14 }}>
              <DonutChart score={selectedRec.opportunity_score} color={getScoreColor(selectedRec.opportunity_score)} />
              <div>
                <div style={{ fontSize: 10, color: '#3e6b2a', letterSpacing: '0.08em', marginBottom: 4 }}>OPPORTUNITY SCORE</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: getScoreColor(selectedRec.opportunity_score) }}>
                  {getScoreLabel(selectedRec.opportunity_score)}
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: getScoreColor(selectedRec.opportunity_score), flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#3e6b2a' }}>Positives · {selectedRec.opportunity_score}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0dbd3', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#3e6b2a' }}>Negatives · {100 - selectedRec.opportunity_score}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Key metrics */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #ddd8cf' }}>
              <div style={{ fontSize: 10, color: '#3e6b2a', letterSpacing: '0.08em', marginBottom: 10 }}>KEY METRICS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#3e6b2a' }}>🏠 Est. Rent</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e12' }}>${selectedRec.estimated_rent.toLocaleString()}/mo</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#3e6b2a' }}>📈 Profit Margin</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e12' }}>{(selectedRec.projected_profit_margin * 100).toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#3e6b2a' }}>🚶 Traffic Now</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: getFootColor(selectedRec.hourly[currentHour]) }}>
                    {selectedRec.hourly[currentHour]}% · {getTrafficLabel(selectedRec.hourly[currentHour])}
                  </span>
                </div>
              </div>
            </div>

            {/* Pros & Cons */}
            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: '#3e6b2a', letterSpacing: '0.08em', marginBottom: 10 }}>ANALYSIS</div>
              {infoPanelData?.pros.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 7 }}>
                  <span style={{ color: getScoreColor(selectedRec.opportunity_score), fontSize: 13, lineHeight: 1.2, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 11, color: '#1a2e12', lineHeight: 1.4 }}>{p}</span>
                </div>
              ))}
              {infoPanelData?.cons.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 7 }}>
                  <span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1.2, flexShrink: 0 }}>✗</span>
                  <span style={{ fontSize: 11, color: '#1a2e12', lineHeight: 1.4 }}>{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline — bottom center ── */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-20%)',
        zIndex: 10, background: 'rgba(232,227,219,0.97)',
        border: '1px solid #ddd8cf', borderRadius: 10, padding: '10px 14px',
        backdropFilter: 'blur(8px)', minWidth: 520,
      }} className="pointer-events-auto">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#3d8b24', letterSpacing: '0.18em', fontFamily: 'monospace' }}>
            FOOT TRAFFIC · {HOURS[currentHour]}{currentHour === new Date().getHours() ? ' · NOW' : ' · FORECAST'}
          </div>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{
            background: isPlaying ? '#fff0f0' : '#f0f7ee',
            border: isPlaying ? '1px solid #fca5a5' : '1px solid #3d8b24',
            borderRadius: 4, padding: '3px 10px',
            color: isPlaying ? '#dc2626' : '#3d8b24',
            fontSize: 10, cursor: 'pointer', fontFamily: 'monospace',
          }}>
            {isPlaying ? '⏹ STOP' : '▶ PLAY'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          {HOURS.map((h, i) => {
            const avg = recommendations.reduce((sum, r) => sum + r.hourly[i], 0) / recommendations.length;
            const color = getFootColor(avg);
            const isNow = i === new Date().getHours();
            const isSelected = i === currentHour;
            return (
              <div key={i} onClick={() => setCurrentHour(i)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{
                  width: 17, height: 36, background: '#f3f0eb', borderRadius: 3, overflow: 'hidden',
                  border: isSelected ? `1px solid ${color}` : isNow ? '1px solid #3d8b24' : '1px solid #ddd8cf',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', bottom: 0, width: '100%', height: `${avg}%`,
                    background: isSelected ? color : `${color}66`, borderRadius: 2, transition: 'height 0.3s',
                  }} />
                </div>
                <div style={{
                  fontSize: 7, marginTop: 2, fontFamily: 'monospace',
                  color: isSelected ? '#1a2e12' : isNow ? '#3d8b24' : '#9ca3af',
                  fontWeight: isSelected || isNow ? 'bold' : 'normal',
                }}>
                  {i % 3 === 0 ? h : ''}
                </div>
                {isNow && <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#3d8b24', marginTop: 1 }} />}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
