/**
 * mapsLoader.js — Singleton Google Maps SDK loader
 * Shared between ThreatMap.jsx and JourneyMode.jsx so the script
 * is only injected into the DOM once regardless of how many components use it.
 */

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

let _mapsPromise = null

/**
 * Returns a promise that resolves to `window.google.maps`.
 * Subsequent calls return the same promise (singleton).
 */
export function loadMapsAPI() {
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (_mapsPromise) return _mapsPromise
  _mapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=geometry`
    s.async = true
    s.onload  = () => resolve(window.google.maps)
    s.onerror = () => { _mapsPromise = null; reject(new Error('Google Maps failed to load')) }
    document.head.appendChild(s)
  })
  return _mapsPromise
}

/** Dark theme style tokens — consistent across all Google Maps in this app */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#94a3b8' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0f172a' }] },
  { featureType: 'road',           elementType: 'geometry.fill',  stylers: [{ color: '#1e2a3a' }] },
  { featureType: 'road.highway',   elementType: 'geometry',       stylers: [{ color: '#2d3f55' }] },
  { featureType: 'water',          elementType: 'geometry',       stylers: [{ color: '#0c1524' }] },
  { featureType: 'poi',            stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',        stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
]
