"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const VENUES = [
  { name: "Tim Hortons", lat: 43.4723, lng: -80.5449, venue_id: "", hourly: [10,8,15,5,10,30,65,80,75,70,60,55,50,60,70,65,55,50,45,40,35,30,20,10] },
  { name: "Waterloo Town Square", lat: 43.4668, lng: -80.5164, venue_id: "", hourly: [5,5,5,5,5,10,20,40,60,75,85,90,88,85,80,75,70,65,55,40,30,20,10,5] },
  { name: "Conestoga Mall", lat: 43.5016, lng: -80.5198, venue_id: "", hourly: [5,5,5,5,5,5,10,15,20,50,75,90,95,90,85,80,70,60,45,30,20,10,5,5] },
  { name: "WLU Campus", lat: 43.4723, lng: -80.5271, venue_id: "", hourly: [5,5,5,5,5,5,10,30,70,85,80,75,60,55,75,80,70,50,40,30,20,15,10,5] },
  { name: "Uptown Waterloo", lat: 43.4668, lng: -80.5222, venue_id: "", hourly: [5,5,5,5,5,5,10,20,35,45,55,65,70,65,60,65,70,80,90,85,75,60,40,15] },
];

const HOURS = ["12a","1a","2a","3a","4a","5a","6a","7a","8a","9a","10a","11a","12p","1p","2p","3p","4p","5p","6p","7p","8p","9p","10p","11p"];

function getBusynessColor(score) {
  if (score >= 80) return "#ff0000";
  if (score >= 60) return "#ff8800";
  if (score >= 40) return "#ffcc00";
  if (score >= 20) return "#00cc44";
  return "#0066ff";
}

function getBusynessLabel(score) {
  if (score >= 80) return "Peak";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  if (score >= 20) return "Low";
  return "Very Low";
}

function buildGeoJSON(venues, hour) {
  return {
    type: "FeatureCollection",
    features: venues.map((v) => ({
      type: "Feature",
      properties: { intensity: v.hourly[hour] / 100, busyness: v.hourly[hour], name: v.name },
      geometry: { type: "Point", coordinates: [v.lng, v.lat] },
    })),
  };
}

export default function FootTrafficMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [heatmapVisible, setHeatmapVisible] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef(null);

  useEffect(() => {
    if (map.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-80.5204, 43.4643],
      zoom: 13,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.current.on("load", () => {
      map.current.addSource("foot-traffic", {
        type: "geojson",
        data: buildGeoJSON(VENUES, new Date().getHours()),
      });

      // Heatmap layer - FIX: maxzoom 22 so it never disappears
      map.current.addLayer({
        id: "foot-traffic-heat",
        type: "heatmap",
        source: "foot-traffic",
        maxzoom: 22,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "intensity"], 0, 0, 1, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1, 15, 3],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 40, 13, 80, 16, 120],
          "heatmap-opacity": 0.8,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0,   "rgba(0,0,255,0)",
            0.1, "#0066ff",
            0.3, "#00cc44",
            0.5, "#ffcc00",
            0.7, "#ff8800",
            0.9, "#ff4400",
            1.0, "#ff0000",
          ],
        },
      });

      // Circle layer - shows correct colors per venue at all zoom levels
      map.current.addLayer({
        id: "foot-traffic-circles",
        type: "circle",
        source: "foot-traffic",
        minzoom: 13,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, ["*", ["get", "intensity"], 20], 16, ["*", ["get", "intensity"], 50]],
          "circle-color": [
            "interpolate", ["linear"], ["get", "intensity"],
            0.0, "#0066ff",
            0.2, "#00cc44",
            0.4, "#ffcc00",
            0.6, "#ff8800",
            0.8, "#ff4400",
            1.0, "#ff0000",
          ],
          "circle-opacity": 0.4,
          "circle-blur": 1,
        },
      });

      addMarkers(new Date().getHours());
      setLoading(false);
    });
    return () => { if (map.current) { map.current.remove(); map.current = null; } };
  }, []);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const source = map.current.getSource("foot-traffic");
    if (!source) return;
    source.setData(buildGeoJSON(VENUES, currentHour));
    addMarkers(currentHour);
  }, [currentHour]);

  function addMarkers(hour) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    VENUES.forEach((venue) => {
      const busyness = venue.hourly[hour];
      const color = getBusynessColor(busyness);
      const label = getBusynessLabel(busyness);
      const el = document.createElement("div");
      el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 10px ${color};cursor:pointer;`;
      const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(`
        <div style="background:#0d1117;color:white;padding:12px 16px;border-radius:6px;font-family:'Courier New',monospace;min-width:180px;">
          <div style="font-size:10px;color:#4a6a8a;letter-spacing:0.1em;margin-bottom:4px">FOOT TRAFFIC · ${HOURS[hour]}</div>
          <div style="font-size:14px;font-weight:bold;margin-bottom:8px">${venue.name}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:11px;color:#888">Busyness</span>
            <span style="font-size:12px;color:${color};font-weight:bold">${busyness}% — ${label}</span>
          </div>
          <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px">
            <div style="height:100%;width:${busyness}%;background:${color};border-radius:2px"></div>
          </div>
        </div>
      `);
      const marker = new mapboxgl.Marker(el).setLngLat([venue.lng, venue.lat]).setPopup(popup).addTo(map.current);
      markersRef.current.push(marker);
    });
  }

  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => setCurrentHour((h) => (h + 1) % 24), 800);
    } else {
      clearInterval(playRef.current);
    }
    return () => clearInterval(playRef.current);
  }, [isPlaying]);

  const toggleHeatmap = () => {
    if (!map.current) return;
    const vis = heatmapVisible ? "none" : "visible";
    map.current.setLayoutProperty("foot-traffic-heat", "visibility", vis);
    map.current.setLayoutProperty("foot-traffic-circles", "visibility", vis);
    setHeatmapVisible(!heatmapVisible);
  };

  const currentScores = VENUES.map((v) => ({ ...v, busyness: v.hourly[currentHour] }));

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", fontFamily: "'Courier New', monospace" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", zIndex: 10 }}>
          <div style={{ textAlign: "center", color: "white" }}>
            <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #00e5a0", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#4a9eff" }}>LOADING TRAFFIC DATA</div>
          </div>
        </div>
      )}

      {/* Toggle top right */}
      <button onClick={toggleHeatmap} style={{ position: "absolute", top: 12, right: 12, zIndex: 5, padding: "8px 16px", background: "rgba(0,0,0,0.8)", border: heatmapVisible ? "1px solid rgba(0,229,160,0.6)" : "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: heatmapVisible ? "#00e5a0" : "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer", backdropFilter: "blur(4px)", transition: "all 0.2s" }}>
        {heatmapVisible ? "FOOT TRAFFIC: ON" : "FOOT TRAFFIC: OFF"}
      </button>

      {/* Time badge top left */}
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 5, padding: "8px 14px", background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 13, color: "white", backdropFilter: "blur(4px)" }}>
        🕐 {HOURS[currentHour]}
        <span style={{ fontSize: 9, color: "#4a6a8a", marginLeft: 8 }}>{currentHour === new Date().getHours() ? "NOW" : "FORECAST"}</span>
      </div>

      {/* Venue scores right */}
      <div style={{ position: "absolute", top: 55, right: 12, zIndex: 5, background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "10px 14px", backdropFilter: "blur(4px)", minWidth: 200 }}>
        <div style={{ fontSize: 9, color: "#3a6aaa", letterSpacing: "0.2em", marginBottom: 8 }}>VENUE SCORES</div>
        {currentScores.map((v) => (
          <div key={v.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{v.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 40, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${v.busyness}%`, background: getBusynessColor(v.busyness), borderRadius: 2, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: "bold", color: getBusynessColor(v.busyness), minWidth: 30 }}>{v.busyness}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend bottom left */}
      <div style={{ position: "absolute", bottom: 130, left: 12, zIndex: 5, background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "10px 14px", backdropFilter: "blur(4px)" }}>
        <div style={{ fontSize: 9, color: "#3a6aaa", letterSpacing: "0.2em", marginBottom: 8 }}>DENSITY</div>
        {[["#ff0000","Peak"],["#ff8800","High"],["#ffcc00","Medium"],["#00cc44","Low"],["#0066ff","Very Low"]].map(([c,l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Timeline bottom center */}
      <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 5, background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px", backdropFilter: "blur(8px)", minWidth: 580 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: "#3a6aaa", letterSpacing: "0.2em" }}>FOOT TRAFFIC TIMELINE — WATERLOO</div>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ background: isPlaying ? "rgba(255,80,80,0.2)" : "rgba(0,229,160,0.15)", border: isPlaying ? "1px solid rgba(255,80,80,0.5)" : "1px solid rgba(0,229,160,0.4)", borderRadius: 4, padding: "4px 12px", color: isPlaying ? "#ff5050" : "#00e5a0", fontSize: 10, cursor: "pointer", letterSpacing: "0.1em" }}>
            {isPlaying ? "⏹ STOP" : "▶ PLAY"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 3, alignItems: "flex-end" }}>
          {HOURS.map((h, i) => {
            const avg = VENUES.reduce((sum, v) => sum + v.hourly[i], 0) / VENUES.length;
            const color = getBusynessColor(avg);
            const isNow = i === new Date().getHours();
            const isSelected = i === currentHour;
            return (
              <div key={i} onClick={() => setCurrentHour(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
                <div style={{ width: 18, height: 40, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", border: isSelected ? `1px solid ${color}` : isNow ? "1px solid #4a9eff" : "1px solid transparent", position: "relative" }}>
                  <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${avg}%`, background: isSelected ? color : `${color}77`, borderRadius: 2, transition: "height 0.3s ease" }} />
                </div>
                <div style={{ fontSize: 7, marginTop: 3, color: isSelected ? "white" : isNow ? "#4a9eff" : "rgba(255,255,255,0.25)", fontWeight: isSelected || isNow ? "bold" : "normal" }}>
                  {i % 3 === 0 ? h : ""}
                </div>
                {isNow && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#4a9eff", marginTop: 1 }} />}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}