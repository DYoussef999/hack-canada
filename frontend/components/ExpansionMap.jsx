'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ── Constants ────────────────────────────────────────────────────────────────

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
const BRANCH_STORAGE_KEY = 'ploutos_branches';

// Minimum separation radius in metres between existing branches and candidate locations.
// Configurable — adjust per business density requirements.
const MIN_SEPARATION_METERS = 1000;

// Proximity warning threshold — warn if within 1.5× the minimum separation
const PROXIMITY_WARN_METERS = MIN_SEPARATION_METERS * 1.5;

// ── Business type → Overpass OSM tags ────────────────────────────────────────

const BUSINESS_OSM_TAGS = {
  'Retail Store':             [['shop', 'clothes'], ['shop', 'department_store'], ['shop', 'mall']],
  'Café / Coffee Shop':       [['amenity', 'cafe']],
  'Restaurant':               [['amenity', 'restaurant'], ['amenity', 'fast_food'], ['amenity', 'cafe']],
  'Fitness Studio':           [['leisure', 'fitness_centre'], ['leisure', 'sports_centre']],
  'Salon & Spa':              [['shop', 'beauty'], ['shop', 'hairdresser']],
  'Medical / Dental Clinic':  [['amenity', 'clinic'], ['amenity', 'dentist'], ['amenity', 'doctors'], ['amenity', 'pharmacy'], ['shop', 'health_food']],
  'Co-working Space':         [['amenity', 'coworking_space'], ['office', 'coworking']],
  'Grocery / Convenience':    [['shop', 'supermarket'], ['shop', 'convenience']],
  'Boutique Hotel':           [['tourism', 'hotel'], ['tourism', 'guest_house']],
  'Bar / Nightlife':          [['amenity', 'bar'], ['amenity', 'pub'], ['amenity', 'nightclub']],
  'Other':                    [['amenity', 'restaurant'], ['shop', '*']],
};

// ── Haversine ────────────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

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

function getFootColor(busyness) {
  if (busyness >= 80) return '#ef4444';
  if (busyness >= 60) return '#f97316';
  if (busyness >= 40) return '#eab308';
  if (busyness >= 20) return '#22c55e';
  return '#94a3b8';
}

function getTrafficLabel(busyness) {
  if (busyness >= 80) return 'Very High';
  if (busyness >= 60) return 'High';
  if (busyness >= 40) return 'Medium';
  if (busyness >= 20) return 'Low';
  return 'Very Low';
}

// ── Traffic analysis helpers ─────────────────────────────────────────────────

function getPeakHours(hourly) {
  if (!hourly || hourly.length < 24) return { peakStart: 12, peakEnd: 14 };
  const max = Math.max(...hourly);
  const peakIdx = hourly.indexOf(max);
  // Find the contiguous block above 70% of peak
  const threshold = max * 0.7;
  let start = peakIdx;
  let end = peakIdx;
  while (start > 0 && hourly[start - 1] >= threshold) start--;
  while (end < 23 && hourly[end + 1] >= threshold) end++;
  return { peakStart: start, peakEnd: end };
}

function formatHourRange(start, end) {
  const fmt = (h) => HOURS[h] || `${h}`;
  return `${fmt(start)} – ${fmt(Math.min(end + 1, 23))}`;
}

// Estimate busiest day from hourly pattern and business type
function getBusiestDay(hourly, businessType) {
  if (!hourly || hourly.length < 24) return 'Saturday';
  const peakTraffic = Math.max(...hourly);
  // Business type heuristics
  if (businessType === 'Restaurant' || businessType === 'Café / Coffee Shop') {
    return peakTraffic >= 60 ? 'Saturday' : 'Friday';
  }
  if (businessType === 'Fitness Studio') return 'Monday';
  if (businessType === 'Retail Store' || businessType === 'Grocery / Convenience') return 'Saturday';
  // Default: weekend for high traffic, weekday for office-oriented
  return peakTraffic >= 50 ? 'Saturday' : 'Wednesday';
}

// ── Overpass API ─────────────────────────────────────────────────────────────

async function fetchCompetitors(lat, lng, businessType, radiusM = 500) {
  const tags = BUSINESS_OSM_TAGS[businessType] || BUSINESS_OSM_TAGS['Other'];
  const queries = tags.map(([k, v]) => {
    const filter = v === '*' ? `["${k}"]` : `["${k}"="${v}"]`;
    return `node${filter}(around:${radiusM},${lat},${lng});way${filter}(around:${radiusM},${lat},${lng});`;
  }).join('');

  const query = `[out:json][timeout:10];(${queries});out center 50;`;

  const doFetch = async () => {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (res.status === 429) throw new Error('429');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  try {
    let data;
    try {
      data = await doFetch();
    } catch (err) {
      if (err.message === '429') {
        // Rate limited — wait 3s and retry once
        console.warn(`Overpass rate-limited — retrying in 3s`);
        await new Promise((r) => setTimeout(r, 3000));
        data = await doFetch();
      } else {
        throw err;
      }
    }
    const elements = (data.elements || []).map((el) => {
      const cLat = el.lat || el.center?.lat;
      const cLon = el.lon || el.center?.lon;
      return {
        name: el.tags?.name || el.tags?.brand || 'Unnamed',
        lat: cLat,
        lon: cLon,
        type: el.tags?.amenity || el.tags?.shop || el.tags?.leisure || el.tags?.tourism || 'business',
        brand: el.tags?.brand || '',
        dist: (cLat && cLon) ? haversine(lat, lng, cLat, cLon) : 9999,
      };
    }).filter((e) => e.lat && e.lon);
    return elements;
  } catch (err) {
    console.warn('Overpass API failed:', err);
    return [];
  }
}

// ── Foot traffic API ──────────────────────────────────────────────────────────

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

// ── Competitor-based scoring logic ────────────────────────────────────────────

function getCompetitorAdjustment(competitors, businessType) {
  if (!competitors || competitors.length === 0) return { adjustment: 5, excluded: false, reason: '+5 bonus (no competitors nearby)' };

  const within300 = competitors.filter((c) => c.dist <= 300);
  const within500 = competitors.filter((c) => c.dist <= 500);

  // EXCLUSION: 3+ direct competitors within 300m
  if (within300.length >= 3) {
    return { adjustment: 0, excluded: true, reason: `Excluded: ${within300.length} competitors within 300m` };
  }

  // EXCLUSION: same brand/chain within 500m (case-insensitive)
  if (businessType) {
    const brandLower = businessType.toLowerCase();
    const sameBrand = within500.find((c) =>
      c.brand && c.brand.toLowerCase().includes(brandLower) ||
      c.name && c.name.toLowerCase().includes(brandLower)
    );
    if (sameBrand) {
      return { adjustment: 0, excluded: true, reason: `Excluded: same-type "${sameBrand.name}" within ${Math.round(sameBrand.dist)}m` };
    }
  }

  // PENALTY: 1-2 within 300m → -10
  if (within300.length >= 1) {
    return { adjustment: -10, excluded: false, reason: `-10 penalty (${within300.length} competitor${within300.length > 1 ? 's' : ''} within 300m)` };
  }

  // PENALTY: 1-2 within 500m → -5
  if (within500.length >= 1) {
    return { adjustment: -5, excluded: false, reason: `-5 penalty (${within500.length} competitor${within500.length > 1 ? 's' : ''} within 500m)` };
  }

  // BONUS: 0 competitors within 500m
  return { adjustment: 5, excluded: false, reason: '+5 bonus (no competitors nearby)' };
}

// ── Pros / Cons with competitor + proximity data ─────────────────────────────

function getProsCons(rec, competitorCount, proximityDist) {
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

  const peakTraffic = Math.max(...(rec.hourly || [0]));
  if (peakTraffic >= 75) pros.push('Strong foot traffic');
  else if (peakTraffic >= 50) pros.push('Moderate foot traffic');
  else cons.push('Limited foot traffic');

  if (competitorCount !== undefined) {
    if (competitorCount <= 2) pros.push('Low competition nearby');
    else if (competitorCount <= 5) cons.push(`${competitorCount} competitors within radius`);
    else cons.push(`High competition (${competitorCount} nearby)`);
  }

  if (proximityDist !== undefined && proximityDist < PROXIMITY_WARN_METERS) {
    cons.push(`Close to existing branch (${Math.round(proximityDist)}m)`);
  }

  // Ensure at least one pro and one con for the donut chart
  if (pros.length === 0) pros.push('Potential growth area');
  if (cons.length === 0) cons.push('No significant risks identified');

  return { pros, cons };
}

// ── Branch storage (localStorage) ────────────────────────────────────────────

function loadBranches() {
  try {
    const saved = localStorage.getItem(BRANCH_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveBranches(branches) {
  localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(branches));
}

// ── Map geometry helpers ───────────────────────────────────────────────────────

function buildingSquare(lng, lat, size = BUILDING_SIZE) {
  return [
    [lng - size, lat - size], [lng + size, lat - size],
    [lng + size, lat + size], [lng - size, lat + size],
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
      properties: { intensity: (rec.hourly || [])[hour] / 100 || 0 },
      geometry: { type: 'Point', coordinates: [rec.longitude, rec.latitude] },
    })),
  };
}

function snapHeatRecsToBuildings(map, recs) {
  if (!map || !map.isStyleLoaded()) return recs;
  return recs.map((rec) => {
    const point = map.project([rec.longitude, rec.latitude]);
    const bbox = [[point.x - 18, point.y - 18], [point.x + 18, point.y + 18]];
    const buildings = map.queryRenderedFeatures(bbox, { layers: ['3d-buildings'] });
    if (buildings.length === 0) return rec;
    const closest = buildings.reduce((best, f) => {
      if (!f.geometry) return best;
      const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
      const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
      const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
      const dist = Math.hypot(cx - rec.longitude, cy - rec.latitude);
      return !best || dist < best.dist ? { cx, cy, dist } : best;
    }, null);
    if (!closest) return rec;
    return { ...rec, longitude: closest.cx, latitude: closest.cy };
  });
}

// Build a GeoJSON circle polygon (approximation) for exclusion zone rendering
function buildCircleGeoJSON(centerLng, centerLat, radiusM, steps = 64) {
  const coords = [];
  const km = radiusM / 1000;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dx = km * Math.cos(angle);
    const dy = km * Math.sin(angle);
    const lat = centerLat + (dy / 111.32);
    const lng = centerLng + (dx / (111.32 * Math.cos(centerLat * Math.PI / 180)));
    coords.push([lng, lat]);
  }
  return coords;
}

function buildExclusionZonesGeoJSON(branches) {
  return {
    type: 'FeatureCollection',
    features: branches.map((b) => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [buildCircleGeoJSON(b.longitude, b.latitude, MIN_SEPARATION_METERS)],
      },
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
    @keyframes pulseRing {
      0%   { transform: scale(0.95); opacity: 0.7; }
      50%  { transform: scale(1.05); opacity: 0.3; }
      100% { transform: scale(0.95); opacity: 0.7; }
    }
    .info-panel-enter { animation: slideInRight 0.38s cubic-bezier(0.34,1.4,0.64,1) forwards; }
    .spin-loader { animation: spinLoader 0.85s linear infinite; }
    .branch-marker {
      width: 28px; height: 28px; border-radius: 50%;
      background: #6366f1; border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(99,102,241,0.45);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExpansionMap({ prefillRent = null }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const moveEndRef = useRef(null);
  const recsRef = useRef([]);
  const hourRef = useRef(new Date().getHours());
  const branchMarkersRef = useRef([]);

  const [recommendations, setRecommendations] = useState(DEFAULT_RECOMMENDATIONS);
  const [trafficDataSource, setTrafficDataSource] = useState('loading');
  const [selectedId, setSelectedId] = useState(null);
  const [heatmapVisible, setHeatmapVisible] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [heatmapRecs, setHeatmapRecs] = useState(DEFAULT_RECOMMENDATIONS);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef(null);

  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [budgetFlash, setBudgetFlash] = useState(false);
  const budgetRef = useRef(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showSearch, setShowSearch] = useState(true);
  const [searchCompleted, setSearchCompleted] = useState(false);

  // Branch state
  const [branches, setBranches] = useState([]);
  const [showConflicting, setShowConflicting] = useState(false);

  // Competitor data keyed by location id
  const [competitorData, setCompetitorData] = useState({});
  const [showCompetitorPins, setShowCompetitorPins] = useState(false);
  const competitorMarkersRef = useRef([]);

  // Compute reference point (centroid of recommendations) for distance display
  const refPoint = recommendations.length > 0
    ? {
        lat: recommendations.reduce((s, r) => s + r.latitude, 0) / recommendations.length,
        lng: recommendations.reduce((s, r) => s + r.longitude, 0) / recommendations.length,
      }
    : { lat: 43.4643, lng: -80.5204 };

  // ── Proximity filtering ────────────────────────────────────────────────────
  const getMinBranchDistance = useCallback((rec) => {
    if (branches.length === 0) return Infinity;
    return Math.min(...branches.map((b) =>
      haversine(rec.latitude, rec.longitude, b.latitude, b.longitude)
    ));
  }, [branches]);

  const isConflicting = useCallback((rec) => {
    return getMinBranchDistance(rec) < MIN_SEPARATION_METERS;
  }, [getMinBranchDistance]);

  // Compute competitor adjustments for each recommendation
  const competitorAdjustments = {};
  recommendations.forEach((rec) => {
    const competitors = competitorData[rec.id];
    if (competitors) {
      competitorAdjustments[rec.id] = getCompetitorAdjustment(competitors, businessType);
    }
  });

  // Filtered recommendations (exclude conflicting unless toggle is on + competitor exclusions)
  const visibleRecs = recommendations.filter((rec) => {
    if (!showConflicting && isConflicting(rec)) return false;
    const adj = competitorAdjustments[rec.id];
    if (adj && adj.excluded) return false;
    return true;
  }).map((rec) => {
    const adj = competitorAdjustments[rec.id];
    if (adj && adj.adjustment !== 0 && !adj.excluded) {
      return {
        ...rec,
        opportunity_score: Math.max(0, Math.min(100, rec.opportunity_score + adj.adjustment)),
        _score_adjusted: true,
        _score_adjustment_reason: adj.reason,
        _original_score: rec.opportunity_score,
      };
    }
    return rec;
  });

  const selectedRec = visibleRecs.find((r) => r.id === selectedId)
    || recommendations.find((r) => r.id === selectedId) || null;

  useEffect(() => { recsRef.current = recommendations; }, [recommendations]);
  useEffect(() => { hourRef.current = currentHour; }, [currentHour]);

  // ── Load branches from localStorage ────────────────────────────────────────
  useEffect(() => {
    setBranches(loadBranches());
  }, []);

  // ── Load live foot traffic on mount ────────────────────────────────────────
  useEffect(() => {
    fetchFootTrafficData().then(({ locations, source }) => {
      setRecommendations(locations);
      setTrafficDataSource(source);
      if (source === 'live') console.log('✓ BestTime API: live foot traffic data loaded');
    });
  }, []);

  // ── Prefill rent from Sandbox ──────────────────────────────────────────────
  useEffect(() => {
    if (prefillRent == null) return;
    setBudget(String(prefillRent));
    setShowSearch(true);
    setBudgetFlash(true);
    const t = setTimeout(() => setBudgetFlash(false), 1500);
    requestAnimationFrame(() => {
      if (budgetRef.current) {
        budgetRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        budgetRef.current.focus();
      }
    });
    return () => clearTimeout(t);
  }, [prefillRent]);

  // ── Fetch competitor data after search completes (sequential, rate-limited) ─
  useEffect(() => {
    if (!searchCompleted || !businessType) return;
    let cancelled = false;

    const fetchAll = async () => {
      const results = {};
      for (let i = 0; i < recommendations.length; i++) {
        if (cancelled) return;
        const rec = recommendations[i];
        try {
          const competitors = await fetchCompetitors(rec.latitude, rec.longitude, businessType);
          results[rec.id] = competitors;
        } catch (err) {
          console.warn(`Overpass rate-limited for ${rec.name} — using default competitor count`);
          results[rec.id] = [];
        }
        // Update progressively so the UI shows data as it arrives
        setCompetitorData((prev) => ({ ...prev, [rec.id]: results[rec.id] }));
        // 1.1s delay between requests to respect Overpass rate limits
        if (i < recommendations.length - 1) {
          await new Promise((r) => setTimeout(r, 1100));
        }
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [searchCompleted, recommendations, businessType]);

  // ── Init Map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    injectStyles();
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-80.5004, 43.4600],
      zoom: 12, pitch: 30, bearing: -10, antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('load', () => {
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find((l) => l.type === 'symbol' && l.layout['text-field'])?.id;

      map.addLayer({
        id: '3d-buildings', source: 'composite', 'source-layer': 'building',
        filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 12,
        paint: {
          'fill-extrusion-color': '#d1cec8',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
          'fill-extrusion-opacity': 0.85,
        },
      }, labelLayerId);

      // Heatmap
      map.addSource('foot-heat', { type: 'geojson', data: buildHeatGeoJSON(DEFAULT_RECOMMENDATIONS, new Date().getHours()) });
      map.addLayer({
        id: 'foot-heat-layer', type: 'heatmap', source: 'foot-heat', maxzoom: 22,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 17, 2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 13, 14, 15, 12, 17, 10, 19, 8],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 15, 0.7, 19, 0.8],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(148,163,184,0)', 0.2, '#94a3b8', 0.4, '#22c55e',
            0.6, '#eab308', 0.8, '#f97316', 1.0, '#ef4444',
          ],
        },
      });
      map.addLayer({
        id: 'foot-heat-points',
        type: 'circle',
        source: 'foot-heat',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 4, 18, 5],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'intensity'],
            0.0, '#94a3b8',
            0.2, '#22c55e',
            0.4, '#eab308',
            0.6, '#f97316',
            0.8, '#ef4444',
          ],
          'circle-opacity': 0.9,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      });
      const heatSrc = map.getSource('foot-heat');
      if (heatSrc) {
        const snapped = snapHeatRecsToBuildings(map, recsRef.current);
        setHeatmapRecs(snapped);
        heatSrc.setData(buildHeatGeoJSON(snapped, hourRef.current));
      }

      // Selected building extrusion
      map.addSource('selected-building', { type: 'geojson', data: emptyGeoJSON() });
      map.addLayer({
        id: 'selected-extrusion', type: 'fill-extrusion', source: 'selected-building',
        paint: { 'fill-extrusion-color': '#22c55e', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.82 },
      });
      map.addLayer({
        id: 'selected-outline', type: 'line', source: 'selected-building',
        paint: { 'line-color': '#22c55e', 'line-width': 2.5, 'line-opacity': 0.9 },
      });

      // Exclusion zone circles for existing branches
      map.addSource('exclusion-zones', { type: 'geojson', data: emptyGeoJSON() });
      map.addLayer({
        id: 'exclusion-zone-fill', type: 'fill', source: 'exclusion-zones',
        paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.06 },
      });
      map.addLayer({
        id: 'exclusion-zone-border', type: 'line', source: 'exclusion-zones',
        paint: { 'line-color': '#6366f1', 'line-width': 1.5, 'line-dasharray': [4, 4], 'line-opacity': 0.4 },
      });
    });

    mapRef.current = map;
    return () => { map.remove(); };
  }, []);

  // ── Update branch markers + exclusion zones on map ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Remove old markers
    branchMarkersRef.current.forEach((m) => m.remove());
    branchMarkersRef.current = [];

    // Add new markers for each branch
    branches.forEach((b) => {
      const el = document.createElement('div');
      el.className = 'branch-marker';
      el.innerHTML = '★';
      el.title = `Existing Branch: ${b.name}`;
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([b.longitude, b.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
          `<div style="font-size:11px;color:#1a2e12;font-weight:600;">${b.name}</div>
           <div style="font-size:10px;color:#6366f1;">Existing Branch</div>`
        ))
        .addTo(map);
      branchMarkersRef.current.push(marker);
    });

    // Update exclusion zone source
    const src = map.getSource('exclusion-zones');
    if (src) src.setData(buildExclusionZonesGeoJSON(branches));
  }, [branches]);

  // ── Selected location: fly + color + building outline ──────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('selected-building');
    if (!src) return;

    if (moveEndRef.current) { map.off('moveend', moveEndRef.current); moveEndRef.current = null; }

    if (!selectedRec) { src.setData(emptyGeoJSON()); return; }

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

  // ── Heatmap hour update ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('foot-heat');
    if (src) {
      const snapped = snapHeatRecsToBuildings(map, recommendations);
      setHeatmapRecs(snapped);
      src.setData(buildHeatGeoJSON(snapped, currentHour));
    }
  }, [currentHour, recommendations]);

  // ── Heatmap toggle ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('foot-heat-layer')) return;
    map.setLayoutProperty('foot-heat-layer', 'visibility', heatmapVisible ? 'visible' : 'none');
    if (map.getLayer('foot-heat-points')) {
      map.setLayoutProperty('foot-heat-points', 'visibility', heatmapVisible ? 'visible' : 'none');
    }
  }, [heatmapVisible]);

  // ── Play animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) { playRef.current = setInterval(() => setCurrentHour((h) => (h + 1) % 24), 800); }
    else { clearInterval(playRef.current); }
    return () => clearInterval(playRef.current);
  }, [isPlaying]);

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!businessType) { setSearchError('Please select a business type.'); return; }
    if (!location.trim()) { setSearchError('Please enter a target location.'); return; }
    setSearchError('');
    setIsSearching(true);
    setCompetitorData({});
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

  // ── Branch management ──────────────────────────────────────────────────────

  const addBranch = useCallback((rec) => {
    const newBranch = {
      id: `branch-${Date.now()}`,
      name: rec.name,
      address: rec.address,
      latitude: rec.latitude,
      longitude: rec.longitude,
      businessType: businessType || 'Other',
    };
    const updated = [...branches, newBranch];
    setBranches(updated);
    saveBranches(updated);
  }, [branches, businessType]);

  const removeBranch = useCallback((branchId) => {
    const updated = branches.filter((b) => b.id !== branchId);
    setBranches(updated);
    saveBranches(updated);
  }, [branches]);

  // ── Derived data for selected rec ──────────────────────────────────────────
  const selectedCompetitors = selectedRec ? (competitorData[selectedRec.id] || []) : [];
  const selectedProximity = selectedRec ? getMinBranchDistance(selectedRec) : Infinity;
  const infoPanelData = selectedRec ? getProsCons(selectedRec, selectedCompetitors.length, selectedProximity) : null;
  const selectedPeak = selectedRec ? getPeakHours(selectedRec.hourly) : null;
  const selectedBusiestDay = selectedRec ? getBusiestDay(selectedRec.hourly, businessType) : null;

  // Count conflicting locations for display
  const conflictingCount = recommendations.filter(isConflicting).length;

  // ── Render ─────────────────────────────────────────────────────────────────
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
            <h2 className="font-bold text-sm mb-3 tracking-wide" style={{ color: '#1a2e12' }}>Find Expansion Locations</h2>
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
            <div className="mb-2">
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs" style={{ color: '#3e6b2a' }}>$</span>
                <input ref={budgetRef} type="number" value={budget || ''} onChange={(e) => setBudget(e.target.value)}
                  placeholder="Max rent/mo"
                  className="w-full rounded-lg pl-6 pr-2 py-2 text-xs focus:outline-none transition"
                  style={{
                    background: '#fff',
                    border: budgetFlash ? '2px solid #3d8b24' : '1px solid #ddd8cf',
                    color: '#1a2e12',
                    boxShadow: budgetFlash ? '0 0 8px rgba(61,139,36,0.35)' : 'none',
                    transition: 'border 0.3s, box-shadow 0.3s',
                  }} />
              </div>
            </div>

            {searchError && <p className="text-xs text-red-600 mb-1">{searchError}</p>}
            <button onClick={handleSearch} disabled={isSearching}
              className="w-full py-2 rounded-lg font-bold text-xs transition disabled:opacity-50"
              style={{ background: '#1a2e12', color: '#fff' }}>
              {isSearching ? 'Searching...' : 'Find Best Locations'}
            </button>
          </div>
        ) : (
          <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid #ddd8cf' }}>
            <div>
              <div className="text-xs font-semibold" style={{ color: '#1a2e12' }}>{businessType || 'All types'} · {location || 'Waterloo'}</div>
              <div className="text-xs mt-0.5" style={{ color: '#3e6b2a' }}>{visibleRecs.length} locations found</div>
            </div>
            <button onClick={() => setShowSearch(true)}
              className="text-xs rounded px-2 py-1 transition"
              style={{ color: '#3e6b2a', border: '1px solid #ddd8cf' }}>
              Edit
            </button>
          </div>
        )}

        {/* Traffic data source + conflict toggle */}
        <div style={{ padding: '5px 14px 4px', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: trafficDataSource === 'live' ? '#22c55e' : trafficDataSource === 'loading' ? '#eab308' : '#94a3b8',
            }} />
            <span style={{ fontSize: 9, color: '#3e6b2a', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
              {trafficDataSource === 'live' ? 'LIVE TRAFFIC DATA' : trafficDataSource === 'loading' ? 'LOADING…' : 'SAMPLE DATA'}
            </span>
          </div>
          {conflictingCount > 0 && (
            <button
              onClick={() => setShowConflicting((v) => !v)}
              style={{
                fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.04em',
                color: showConflicting ? '#ef4444' : '#3e6b2a',
                background: 'none', border: 'none', cursor: 'pointer',
                textDecoration: 'underline', padding: 0,
              }}
            >
              {showConflicting ? `HIDE ${conflictingCount} CONFLICTS` : `SHOW ${conflictingCount} CONFLICTS`}
            </button>
          )}
        </div>

        {/* My Branches section */}
        {branches.length > 0 && (
          <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: '#6366f1', fontFamily: 'monospace', letterSpacing: '0.06em', fontWeight: 700 }}>
                MY BRANCHES ({branches.length})
              </span>
            </div>
            {branches.map((b) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: '#1a2e12' }}>{b.name}</span>
                </div>
                <button onClick={() => removeBranch(b.id)}
                  style={{ fontSize: 9, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Location cards list */}
        <div className="flex-1 overflow-y-auto relative" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ddd8cf transparent' }}>
          {(searchCompleted
            ? [...visibleRecs].sort((a, b) => b.opportunity_score - a.opportunity_score)
            : visibleRecs
          ).map((rec, idx) => {
              const busyness = (rec.hourly || [])[currentHour] || 0;
              const isActive = selectedId === rec.id;
              const scoreColor = getScoreColor(rec.opportunity_score);
              const scoreBg = getScoreBg(rec.opportunity_score);
              const badgeTextColor = (rec.opportunity_score >= 40 && rec.opportunity_score < 80) ? '#1a2e12' : '#fff';
              const conflict = isConflicting(rec);
              const distFromCenter = haversine(rec.latitude, rec.longitude, refPoint.lat, refPoint.lng);
              const competitors = competitorData[rec.id] || [];

              return (
                <div key={rec.id}
                  className="loc-card"
                  onClick={() => setSelectedId(isActive ? null : rec.id)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                    cursor: 'pointer',
                    background: conflict ? 'rgba(239,68,68,0.05)' : (isActive && searchCompleted) ? scoreBg : 'transparent',
                    borderLeft: `3px solid ${conflict ? '#ef4444' : (isActive && searchCompleted) ? scoreColor : 'transparent'}`,
                    transition: 'background 0.4s ease, border-color 0.4s ease',
                    opacity: conflict ? 0.7 : 1,
                  }}>

                  {/* Row 1: rank + name + score badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#3e6b2a', fontFamily: 'monospace', minWidth: 14 }}>{idx + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1a2e12' }}>
                      {rec.name}
                    </span>
                    {conflict && (
                      <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 10, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontWeight: 700 }}>
                        TOO CLOSE
                      </span>
                    )}
                    {searchCompleted && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: conflict ? '#94a3b8' : scoreColor, color: conflict ? '#fff' : badgeTextColor,
                      }}>
                        {rec.opportunity_score}
                      </span>
                    )}
                  </div>

                  {/* Row 2: address */}
                  <div style={{ fontSize: 11, color: '#3e6b2a', marginBottom: 6, paddingLeft: 22 }}>{rec.address}</div>

                  {/* Row 3: stats */}
                  <div style={{ display: 'flex', gap: 10, paddingLeft: 22, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, color: '#3e6b2a' }}>
                      <span style={{ color: '#1a2e12' }}>${(rec.estimated_rent || 0).toLocaleString()}/mo</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#3e6b2a' }}>
                      <span style={{ color: '#1a2e12' }}>{((rec.projected_profit_margin || 0) * 100).toFixed(0)}% margin</span>
                    </div>
                    {searchCompleted && (
                      <div style={{ fontSize: 11, color: '#3e6b2a' }}>
                        <span style={{ color: '#1a2e12' }}>{(distFromCenter / 1000).toFixed(1)} km away</span>
                      </div>
                    )}
                  </div>

                  {/* Row 4: traffic + competitors */}
                  <div style={{ paddingLeft: 22, marginTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: '#3e6b2a' }}>Traffic · {HOURS[currentHour]}</span>
                        {searchCompleted && competitors.length > 0 && (
                          <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 600 }}>
                            · {competitors.length} competitors
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: getFootColor(busyness) }} />
                        <span style={{ fontSize: 10, color: getFootColor(busyness), fontWeight: 600 }}>{getTrafficLabel(busyness)}</span>
                      </div>
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
            <span style={{ fontSize: 12, color: heatmapVisible ? '#1a2e12' : '#3e6b2a', fontWeight: 600 }}>Foot Traffic Heatmap</span>
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
            width: 306,
            maxHeight: 'calc(100vh - 220px)',
            background: 'rgba(232,227,219,0.98)',
            borderRadius: 24,
            border: `1px solid ${isConflicting(selectedRec) ? '#fca5a5' : '#ddd8cf'}`,
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
              {/* Save as branch button */}
              {!branches.some((b) => b.name === selectedRec.name) && (
                <button onClick={(e) => { e.stopPropagation(); addBranch(selectedRec); }}
                  style={{
                    marginTop: 8, fontSize: 10, padding: '4px 10px', borderRadius: 6,
                    background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer',
                    fontWeight: 600,
                  }}>
                  ★ Save as My Branch
                </button>
              )}
            </div>

            {/* Proximity warning */}
            {selectedProximity < PROXIMITY_WARN_METERS && (
              <div style={{
                padding: '10px 18px',
                background: selectedProximity < MIN_SEPARATION_METERS ? '#fef2f2' : '#fffbeb',
                borderBottom: '1px solid #ddd8cf',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: selectedProximity < MIN_SEPARATION_METERS ? '#dc2626' : '#d97706' }}>
                    {selectedProximity < MIN_SEPARATION_METERS ? 'TOO CLOSE TO EXISTING BRANCH' : 'NEAR EXISTING BRANCH'}
                  </div>
                  <div style={{ fontSize: 10, color: '#3e6b2a' }}>
                    {Math.round(selectedProximity)}m from nearest branch (min: {MIN_SEPARATION_METERS}m)
                  </div>
                </div>
              </div>
            )}

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
                  <span style={{ fontSize: 12, color: '#3e6b2a' }}>Est. Rent</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e12' }}>${(selectedRec.estimated_rent || 0).toLocaleString()}/mo</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#3e6b2a' }}>Profit Margin</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e12' }}>{((selectedRec.projected_profit_margin || 0) * 100).toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#3e6b2a' }}>Traffic Now</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: getFootColor((selectedRec.hourly || [])[currentHour] || 0) }}>
                    {(selectedRec.hourly || [])[currentHour] || 0}% · {getTrafficLabel((selectedRec.hourly || [])[currentHour] || 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#3e6b2a' }}>Distance</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e12' }}>
                    {(haversine(selectedRec.latitude, selectedRec.longitude, refPoint.lat, refPoint.lng) / 1000).toFixed(1)} km from centre
                  </span>
                </div>
              </div>
            </div>

            {/* Foot traffic details */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #ddd8cf' }}>
              <div style={{ fontSize: 10, color: '#3e6b2a', letterSpacing: '0.08em', marginBottom: 10 }}>FOOT TRAFFIC</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#3e6b2a' }}>Current Level</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: getFootColor((selectedRec.hourly || [])[currentHour] || 0) }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: getFootColor((selectedRec.hourly || [])[currentHour] || 0) }}>
                      {getTrafficLabel((selectedRec.hourly || [])[currentHour] || 0)}
                    </span>
                  </div>
                </div>
                {selectedPeak && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#3e6b2a' }}>Peak Hours</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1a2e12' }}>
                      {formatHourRange(selectedPeak.peakStart, selectedPeak.peakEnd)}
                    </span>
                  </div>
                )}
                {selectedBusiestDay && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#3e6b2a' }}>Busiest Day</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1a2e12' }}>{selectedBusiestDay}</span>
                  </div>
                )}
                {trafficDataSource !== 'live' && (
                  <div style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>
                    {trafficDataSource === 'fallback' ? 'Based on sample data' : 'Estimated from area density'}
                  </div>
                )}
              </div>
            </div>

            {/* Competitors */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #ddd8cf' }}>
              <div style={{ fontSize: 10, color: '#3e6b2a', letterSpacing: '0.08em', marginBottom: 10 }}>
                COMPETITORS NEARBY
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#6366f1' }}>
                  {selectedCompetitors.length}
                </span>
              </div>
              {selectedCompetitors.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedCompetitors.slice(0, 8).map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366f1', flexShrink: 0, opacity: 0.5 }} />
                      <span style={{ fontSize: 10, color: '#1a2e12', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    </div>
                  ))}
                  {selectedCompetitors.length > 8 && (
                    <div style={{ fontSize: 9, color: '#94a3b8', paddingLeft: 11 }}>
                      +{selectedCompetitors.length - 8} more
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
                  {searchCompleted ? 'No competitors found within 1km' : 'Search to load competitor data'}
                </div>
              )}
            </div>

            {/* Pros & Cons */}
            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: '#3e6b2a', letterSpacing: '0.08em', marginBottom: 10 }}>ANALYSIS</div>
              {infoPanelData?.pros.map((p, i) => (
                <div key={`p-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 7 }}>
                  <span style={{ color: getScoreColor(selectedRec.opportunity_score), fontSize: 13, lineHeight: 1.2, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 11, color: '#1a2e12', lineHeight: 1.4 }}>{p}</span>
                </div>
              ))}
              {infoPanelData?.cons.map((c, i) => (
                <div key={`c-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 7 }}>
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
            const avg = recommendations.length > 0
              ? recommendations.reduce((sum, r) => sum + ((r.hourly || [])[i] || 0), 0) / recommendations.length
              : 0;
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
