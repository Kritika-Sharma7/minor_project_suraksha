import React, { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getThreatMap } from './apiClient'
import { useSafetyStore } from './safetyStore'

const LEVEL_COLORS = {
  SAFE: '#22c55e',
  SUSPICIOUS: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
}

export default function ThreatMap() {
  const { mapPoints, setMapPoints } = useSafetyStore()

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await getThreatMap(300)
        setMapPoints(resp.points || [])
      } catch {
        // non-blocking
      }
    }
    load()
  }, [])

  const center = mapPoints.length ? [mapPoints[0].lat, mapPoints[0].lon] : [20.5937, 78.9629]

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display font-bold text-sm tracking-widest text-white">THREAT MAP</h2>
        <span className="text-[10px] text-slate-500 font-mono">{mapPoints.length} points</span>
      </div>

      <div className="h-64 rounded-xl overflow-hidden border border-white/10">
        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mapPoints.map((point) => (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lon]}
              radius={Math.max(4, (point.combined_score || 0) / 45)}
              pathOptions={{
                color: LEVEL_COLORS[point.threat_level] || '#60a5fa',
                fillColor: LEVEL_COLORS[point.threat_level] || '#60a5fa',
                fillOpacity: 0.45,
              }}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong>{point.threat_level}</strong>
                  <div>Score: {Math.round(point.combined_score || 0)}</div>
                  <div>{new Date(point.created_at).toLocaleString()}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
