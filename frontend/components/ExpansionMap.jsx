'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ── Opportunity Locations ─────────────────────────────────────────────────────
// Each location has its own hourly foot traffic so the heatmap follows them.
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
const BUILDING_SIZE = 0.00022; // fallback square ~20m

// ── Helpers ───────────────────────────────────────────────────────────────────
function getScoreColor(score) {
  if (score >= 75) return '#4ade80';   // muted green
  if (score >= 50) return '#fbbf24';   // muted amber
  return '#f87171';                    // muted red
}

function getScoreBg(score) {
  if (score >= 75) return 'rgba(74,222,128,0.1)';
  if (score >= 50) return 'rgba(251,191,36,0.1)';
  return 'rgba(248,113,113,0.1)';
}

function getScoreLabel(score) {
  if (score >= 75) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

function getFootColor(busyness) {
  if (busyness >= 80) return '#86efac';  // soft green
  if (busyness >= 60) return '#6ee7b7';  // soft teal-green
  if (busyness >= 40) return '#5eead4';  // teal
  if (busyness >= 20) return '#67e8f9';  // cyan
  return '#7dd3fc';                      // soft blue
}

function getTrafficLabel(busyness) {
  if (busyness >= 80) return 'Peak';
  if (busyness >= 60) return 'Busy';
  if (busyness >= 40) return 'Moderate';
  if (busyness >= 20) return 'Quiet';
  return 'Very Quiet';
}

// Fallback square if queryRenderedFeatures finds no building at the coordinate
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

// Expand every ring of a polygon outward from its centroid by `amount` degrees.
// This makes the green extrusion sit just outside the grey building so they don't
// directly overlap and the outline is clearly visible.
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

  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(expandRing) };
  }
  if (geometry.type === 'MultiPolygon') {
    return { ...geometry, coordinates: geometry.coordinates.map((poly) => poly.map(expandRing)) };
  }
  return geometry;
}

// Build GeoJSON from a real OSM building feature, buffered outward so the green
// extrusion sits just outside the grey building footprint
function buildFromRealFeature(feature, height) {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { height },
      geometry: bufferPolygon(feature.geometry),
    }],
  };
}

// Fallback: use a small square at the coordinate
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

// GeoJSON for foot traffic heatmap — only uses the opportunity locations
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

let stylesInjected = false;
function injectStyles() {
  if (typeof window === 'undefined' || stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .expansion-popup .mapboxgl-popup-content {
      background: #e8e3db !important;
      border: 1px solid #ddd8cf;
      border-radius: 10px;
      padding: 0;
      box-shadow: 0 10px 30px rgba(26,46,18,0.12);
    }
    .expansion-popup .mapboxgl-popup-tip { border-top-color: #e8e3db !important; }
    .expansion-popup .mapboxgl-popup-close-button {
      color: #3e6b2a;
      font-size: 18px;
      padding: 6px 10px;
      line-height: 1;
      background: transparent;
      border-radius: 0 10px 0 0;
    }
    .expansion-popup .mapboxgl-popup-close-button:hover {
      color: #1a2e12;
      background: rgba(26,46,18,0.06);
    }
    .loc-card:hover { background: rgba(26,46,18,0.04) !important; }
    .loc-card.active { background: rgba(61,139,36,0.08) !important; border-color: rgba(61,139,36,0.4) !important; }
  `;
  document.head.appendChild(style);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExpansionMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);

  const [recommendations, setRecommendations] = useState(DEFAULT_RECOMMENDATIONS);
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

  const selectedRec = recommendations.find((r) => r.id === selectedId) || null;

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

      // Dark city buildings
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

      // Foot traffic heatmap — tied to opportunity locations, stays visible at all zooms
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
          // Radius grows as you zoom in so it stays visible at street level
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 20, 13, 40, 15, 25, 17, 18, 19, 14],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 15, 0.7, 19, 0.8],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(14,116,144,0)',
            0.2, '#164e63',
            0.4, '#0e7490',
            0.6, '#0d9488',
            0.8, '#059669',
            1.0, '#16a34a',
          ],
        },
      });

      // Selected building — starts empty, filled when user clicks a card
      map.addSource('selected-building', {
        type: 'geojson',
        data: emptyGeoJSON(),
      });
      map.addLayer({
        id: 'selected-extrusion',
        type: 'fill-extrusion',
        source: 'selected-building',
        paint: {
          'fill-extrusion-color': '#2d6a4f',   // muted forest green
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.75,
        },
      });
      // Soft green outline — traces the real building edge
      map.addLayer({
        id: 'selected-outline',
        type: 'line',
        source: 'selected-building',
        paint: {
          'line-color': '#4ade80',
          'line-width': 2,
          'line-opacity': 0.7,
        },
      });
    });

    mapRef.current = map;
    return () => { map.remove(); };
  }, []);

  const moveEndRef = useRef(null);

  // ── When a card is selected: fly + snap green outline to real building ──────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const src = map.getSource('selected-building');
    if (!src) return;

    // Always kill any in-flight moveend listener and popup first
    if (moveEndRef.current) {
      map.off('moveend', moveEndRef.current);
      moveEndRef.current = null;
    }
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }

    if (!selectedRec) {
      src.setData(emptyGeoJSON());
      return;
    }

    // Fly in first — building tiles need to be rendered before we can query them
    map.flyTo({
      center: [selectedRec.longitude, selectedRec.latitude],
      zoom: 17,
      pitch: 58,
      bearing: -18,
      duration: 1800,
      essential: true,
    });

    // Capture selectedRec in closure so stale calls don't bleed across switches
    const recSnapshot = selectedRec;

    const onMoveEnd = () => {
      // Guard: if user already switched to another card, bail out
      if (moveEndRef.current !== onMoveEnd) return;
      moveEndRef.current = null;

      const point = map.project([recSnapshot.longitude, recSnapshot.latitude]);
      const bbox = [
        [point.x - 20, point.y - 20],
        [point.x + 20, point.y + 20],
      ];

      const buildings = map.queryRenderedFeatures(bbox, { layers: ['3d-buildings'] });
      const targetHeight = 15 + recSnapshot.opportunity_score * 0.5;

      if (buildings.length > 0) {
        const closest = buildings.reduce((best, f) => {
          if (!f.geometry) return best;
          const coords = f.geometry.type === 'Polygon'
            ? f.geometry.coordinates[0]
            : f.geometry.coordinates[0][0];
          const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
          const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
          const dist = Math.hypot(cx - recSnapshot.longitude, cy - recSnapshot.latitude);
          return !best || dist < best.dist ? { f, dist } : best;
        }, null);
        // Use actual OSM building height, boosted slightly so the green cap clears the roof
        const osmHeight = (closest.f.properties?.height || closest.f.properties?.render_height || 12) * 1.4;
        src.setData(buildFromRealFeature(closest.f, osmHeight));
      } else {
        src.setData(buildFallbackGeoJSON(recSnapshot));
      }

      // Show popup
      const busyness = recSnapshot.hourly[currentHour];
      if (popupRef.current) { popupRef.current.remove(); }
      popupRef.current = new mapboxgl.Popup({ offset: 30, className: 'expansion-popup', closeButton: true })
        .setLngLat([recSnapshot.longitude, recSnapshot.latitude])
        .setHTML(`
          <div style="font-family:'Inter',sans-serif;padding:14px;min-width:230px;color:#1a2e12;">
            <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${recSnapshot.name}</h3>
            <p style="margin:0 0 10px;font-size:11px;color:#3e6b2a;">${recSnapshot.address}</p>
            <div style="display:flex;flex-direction:column;gap:5px;font-size:12px;">
              <div>🎯 <b>Score:</b> <span style="color:${getScoreColor(recSnapshot.opportunity_score)};font-weight:700;">${recSnapshot.opportunity_score}/100 · ${getScoreLabel(recSnapshot.opportunity_score)}</span></div>
              <div>🏠 <b>Est. Rent:</b> $${recSnapshot.estimated_rent.toLocaleString()}/mo</div>
              <div>📈 <b>Projected Margin:</b> ${(recSnapshot.projected_profit_margin * 100).toFixed(1)}%</div>
              <div>🚶 <b>Traffic Now:</b> <span style="color:${getFootColor(busyness)}">${busyness}% · ${getTrafficLabel(busyness)}</span></div>
            </div>
          </div>
        `)
        .addTo(map);
    };

    moveEndRef.current = onMoveEnd;
    map.on('moveend', onMoveEnd);
  }, [selectedId]);

  // ── Update foot traffic heatmap on hour change ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('foot-heat');
    if (src) src.setData(buildHeatGeoJSON(recommendations, currentHour));
  }, [currentHour]);

  // ── Toggle heatmap ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('foot-heat-layer')) return;
    map.setLayoutProperty('foot-heat-layer', 'visibility', heatmapVisible ? 'visible' : 'none');
  }, [heatmapVisible]);

  // ── Play animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => setCurrentHour((h) => (h + 1) % 24), 800);
    } else {
      clearInterval(playRef.current);
    }
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
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_type: businessType,
            location: location,
            budget: budget ? parseFloat(budget) : null,
          }),
        }
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
      // Fall back to default data so the map still works
      setRecommendations(DEFAULT_RECOMMENDATIONS);
    } finally {
      setIsSearching(false);
      setShowSearch(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none">

      {/* Map */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0 pointer-events-auto" />

      {/* ── Left Sidebar ── */}
      <div className="absolute top-16 left-0 bottom-0 w-80 z-10 flex flex-col pointer-events-auto"
        style={{ background: 'rgba(232,227,219,0.97)', borderRight: '1px solid #ddd8cf' }}>

        {/* Search panel — collapses after search */}
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

        {/* Location cards list */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ddd8cf transparent' }}>
          {recommendations
            .sort((a, b) => b.opportunity_score - a.opportunity_score)
            .map((rec, idx) => {
              const busyness = rec.hourly[currentHour];
              const isActive = selectedId === rec.id;
              return (
                <div key={rec.id}
                  className="loc-card"
                  onClick={() => setSelectedId(isActive ? null : rec.id)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(61,139,36,0.08)' : 'transparent',
                    borderLeft: isActive ? '3px solid #3d8b24' : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}>

                  {/* Row 1: rank + name + score badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#3e6b2a', fontFamily: 'monospace', minWidth: 14 }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: isActive ? '#3d8b24' : '#1a2e12' }}>
                      {rec.name}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                      color: getScoreColor(rec.opportunity_score),
                      background: getScoreBg(rec.opportunity_score),
                      border: `1px solid ${getScoreColor(rec.opportunity_score)}44`,
                    }}>
                      {rec.opportunity_score}
                    </span>
                  </div>

                  {/* Row 2: address */}
                  <div style={{ fontSize: 11, color: '#3e6b2a', marginBottom: 8, paddingLeft: 22 }}>
                    {rec.address}
                  </div>

                  {/* Row 3: stats */}
                  <div style={{ display: 'flex', gap: 10, paddingLeft: 22 }}>
                    <div style={{ fontSize: 11, color: '#3e6b2a' }}>
                      🏠 <span style={{ color: '#1a2e12' }}>${rec.estimated_rent.toLocaleString()}/mo</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#3e6b2a' }}>
                      📈 <span style={{ color: '#1a2e12' }}>{(rec.projected_profit_margin * 100).toFixed(0)}% margin</span>
                    </div>
                  </div>

                  {/* Row 4: foot traffic bar */}
                  <div style={{ paddingLeft: 22, marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#3e6b2a' }}>🚶 Foot traffic · {HOURS[currentHour]}</span>
                      <span style={{ fontSize: 10, color: getFootColor(busyness), fontWeight: 600 }}>
                        {getTrafficLabel(busyness)}
                      </span>
                    </div>
                    <div style={{ height: 4, background: '#ddd8cf', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${busyness}%`,
                        background: getFootColor(busyness),
                        borderRadius: 4, transition: 'width 0.4s, background 0.4s',
                      }} />
                    </div>
                  </div>

                  {/* Expand hint */}
                  {isActive && (
                    <div style={{ paddingLeft: 22, marginTop: 8, fontSize: 10, color: '#3d8b24', opacity: 0.7 }}>
                      ↑ Viewing on map · click again to deselect
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Foot traffic heatmap toggle at bottom of sidebar */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid #ddd8cf' }}>
          <button onClick={() => setHeatmapVisible((prev) => !prev)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 8,
              background: heatmapVisible ? '#f0f7ee' : '#faf8f4',
              border: heatmapVisible ? '1px solid #3d8b24' : '1px solid #ddd8cf',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
            <span style={{ fontSize: 12, color: heatmapVisible ? '#1a2e12' : '#3e6b2a', fontWeight: 600 }}>
              🌡 Foot Traffic Heatmap
            </span>
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

      {/* ── Timeline — bottom center (accounts for sidebar) ── */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-20%)',
        zIndex: 10, background: 'rgba(232,227,219,0.97)',
        border: '1px solid #ddd8cf',
        borderRadius: 10, padding: '10px 14px',
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
                  width: 17, height: 36,
                  background: '#f3f0eb',
                  borderRadius: 3, overflow: 'hidden',
                  border: isSelected ? `1px solid ${color}` : isNow ? '1px solid #3d8b24' : '1px solid #ddd8cf',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', bottom: 0, width: '100%',
                    height: `${avg}%`,
                    background: isSelected ? color : `${color}66`,
                    borderRadius: 2, transition: 'height 0.3s',
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