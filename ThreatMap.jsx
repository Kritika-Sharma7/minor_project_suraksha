/**
 * ThreatMap.jsx — Spatial Risk Map (Google Maps)
 *
 * Rendering strategy:
 *  - Current position  → a single green Marker (updated as GPS moves, no re-zoom)
 *  - Alert events      → Circle overlays for SUSPICIOUS / HIGH / CRITICAL live points
 *  - Map pan/zoom      → only on first GPS fix; user can zoom freely after that
 *
 * This avoids the fitBounds-on-every-frame jitter that caused the gray tiles bug.
 */
import React, { useEffect, useRef, useState } from 'react'
import { useSafetyStore } from './safetyStore'
import { loadMapsAPI, DARK_MAP_STYLE } from './mapsLoader'

const LEVEL_COLOR = {
  SUSPICIOUS: '#f59e0b',
  WARNING:    '#f59e0b',
  HIGH:       '#f97316',
  DANGER:     '#f97316',
  CRITICAL:   '#ef4444',
  ALERT:      '#ef4444',
}

const ALERT_LEVELS = new Set(Object.keys(LEVEL_COLOR))
const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 }

function scoreToRadius(score) {
  return Math.max(25, (Math.min(score, 100) / 100) * 120)
}

export default function ThreatMap() {
  const { mapPoints, sensorFrame } = useSafetyStore()

  const [mapsReady, setMapsReady] = useState(false)
  const [error, setError]         = useState(null)

  const mapDivRef      = useRef(null)
  const mapRef         = useRef(null)
  const markerRef      = useRef(null)   // current-position marker
  const circlesRef     = useRef([])     // alert circles
  const infoWindowRef  = useRef(null)
  const centeredRef    = useRef(false)  // true once we've panned to first GPS fix

  // ── Load Maps SDK ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadMapsAPI()
      .then(() => setMapsReady(true))
      .catch(() => setError('Google Maps failed to load — check API key in .env'))
  }, [])

  // ── Init map (once) ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !mapDivRef.current || mapRef.current) return
    const gm = window.google.maps
    mapRef.current = new gm.Map(mapDivRef.current, {
      center:          INDIA_CENTER,
      zoom:            5,
      styles:          DARK_MAP_STYLE,
      disableDefaultUI: true,
      zoomControl:     true,
      zoomControlOptions: { position: gm.ControlPosition.RIGHT_CENTER },
      gestureHandling: 'greedy',
    })
    infoWindowRef.current = new gm.InfoWindow()
  }, [mapsReady])

  // ── Update current-position marker whenever live GPS changes ─────────────
  useEffect(() => {
    if (!mapsReady || !mapRef.current) return
    const gm  = window.google.maps
    const loc = sensorFrame?.location
    if (!loc?.lat || !loc?.lon) return

    const pos = { lat: loc.lat, lng: loc.lon }

    if (!markerRef.current) {
      markerRef.current = new gm.Marker({
        map:      mapRef.current,
        position: pos,
        title:    'Current position',
        icon: {
          path:        gm.SymbolPath.CIRCLE,
          scale:       8,
          fillColor:   '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        zIndex: 10,
      })
    } else {
      markerRef.current.setPosition(pos)
    }

    // Pan to first GPS fix only — never auto-zoom after that
    if (!centeredRef.current) {
      mapRef.current.setCenter(pos)
      mapRef.current.setZoom(15)
      centeredRef.current = true
    }
  }, [mapsReady, sensorFrame?.location?.lat, sensorFrame?.location?.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draw alert circles (non-SAFE live points only) ────────────────────────
  useEffect(() => {
    if (!mapsReady || !mapRef.current) return
    const gm = window.google.maps

    // Remove old circles
    circlesRef.current.forEach(c => c.setMap(null))
    circlesRef.current = []

    // Only the most-recent 20 non-SAFE points
    const alertPoints = mapPoints
      .filter(p => p.lat && p.lon && ALERT_LEVELS.has(p.threat_level))
      .slice(0, 20)

    alertPoints.forEach(point => {
      const color  = LEVEL_COLOR[point.threat_level] || '#60a5fa'
      const radius = scoreToRadius(point.combined_score || 0)

      const circle = new gm.Circle({
        map:           mapRef.current,
        center:        { lat: point.lat, lng: point.lon },
        radius,
        strokeColor:   color,
        strokeOpacity: 0.9,
        strokeWeight:  2,
        fillColor:     color,
        fillOpacity:   0.18,
        clickable:     true,
        zIndex:        5,
      })

      circle.addListener('click', () => {
        const ts = point.created_at
          ? new Date(point.created_at).toLocaleTimeString()
          : 'Live'
        infoWindowRef.current.setContent(`
          <div style="background:#0f172a;color:#e2e8f0;font-family:monospace;
            font-size:12px;padding:10px 14px;border-radius:8px;min-width:160px;line-height:1.8">
            <div style="font-weight:bold;color:${color};margin-bottom:4px">
              ${point.threat_level} · LIVE
            </div>
            <div>Risk: <b>${Math.round(point.combined_score || 0)}</b> / 100</div>
            <div style="color:#64748b;font-size:10px;margin-top:4px">${ts}</div>
          </div>
        `)
        infoWindowRef.current.setPosition({ lat: point.lat, lng: point.lon })
        infoWindowRef.current.open(mapRef.current)
      })

      circlesRef.current.push(circle)
    })
  }, [mapsReady, mapPoints]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived counts for legend ─────────────────────────────────────────────
  const alertPoints = mapPoints.filter(p => ALERT_LEVELS.has(p.threat_level))
  const counts = alertPoints.reduce((acc, p) => {
    acc[p.threat_level] = (acc[p.threat_level] || 0) + 1
    return acc
  }, {})

  const hasGps = !!sensorFrame?.location?.lat

  const legend = [
    { level: 'SAFE',       color: '#22c55e' },
    { level: 'SUSPICIOUS', color: '#f59e0b' },
    { level: 'HIGH',       color: '#f97316' },
    { level: 'CRITICAL',   color: '#ef4444' },
  ]

  return (
    <div className="glass rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display font-bold text-sm tracking-widest text-white">THREAT MAP</h2>
        <div className="flex items-center gap-3">
          {alertPoints.length > 0 && (
            <span className="text-[9px] text-amber-400 font-mono font-bold">
              {alertPoints.length} alert{alertPoints.length !== 1 ? 's' : ''}
            </span>
          )}
          {hasGps && (
            <span className="text-[9px] text-green-400 font-mono font-bold">live</span>
          )}
        </div>
      </div>

      {/* Map container */}
      <div className="h-64 rounded-xl overflow-hidden border border-white/10 relative">
        <div ref={mapDivRef} style={{ height: '100%', width: '100%' }} />

        {!mapsReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/80 text-slate-400 text-xs font-mono gap-2">
            <span className="animate-spin">⟳</span> Loading map…
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/90 text-red-400 text-xs font-mono px-4 text-center">
            {error}
          </div>
        )}

        {mapsReady && !hasGps && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a]/70 gap-2 px-6 text-center pointer-events-none">
            <span className="text-slate-400 text-xs font-mono">Waiting for GPS fix…</span>
            <span className="text-slate-600 text-[10px] font-mono">Allow location access to populate the map</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {legend.map(({ level, color }) => (
          <div key={level} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, opacity: 0.85 }} />
            <span className="text-[9px] font-mono text-slate-400">
              {level}{counts[level] ? ` (${counts[level]})` : ''}
            </span>
          </div>
        ))}
        <span className="ml-auto text-[9px] text-slate-600 font-mono">© Google Maps</span>
      </div>
    </div>
  )
}
