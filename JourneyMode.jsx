/**
 * JourneyMode.jsx — GPS Behavior Detection + Google Maps Route Tracking
 * Pipeline: GPS → Haversine → Speed → StopDetector → RouteDeviationDetector → Risk
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigation, CheckCircle, XCircle, AlertTriangle, MapPin, Activity } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import { vibrate, VIBRATE } from './mobileUtils'
import {
  haversine, qualityFilter, computeSpeed, speedLabel,
  StopDetector, RouteDeviationDetector, computeGpsRisk,
} from './gpsProcessor'
import { loadMapsAPI, DARK_MAP_STYLE } from './mapsLoader'
import toast from 'react-hot-toast'

const DARK_STYLE = DARK_MAP_STYLE

const STATES = { IDLE: 'idle', ACTIVE: 'active', ARRIVED: 'arrived', OVERDUE: 'overdue' }

function fmt(s) {
  const a = Math.abs(s)
  return `${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`
}

export default function JourneyMode() {
  const [state,         setState]        = useState(STATES.IDLE)
  const [pickup,        setPickup]       = useState('')
  const [destination,   setDestination]  = useState('')
  const [durationMin,   setDurationMin]  = useState(15)
  const [elapsed,       setElapsed]      = useState(0)
  const [remaining,     setRemaining]    = useState(0)
  const [alertsSent,    setAlertsSent]   = useState(0)
  const [mapsReady,     setMapsReady]    = useState(false)
  const [routeLoading,  setRouteLoading] = useState(false)

  // GPS features state (displayed live)
  const [gpsFeatures, setGpsFeatures] = useState({
    speed: 0, stationary_time: 0, confirmed_stop: false, stop_score: 0,
    deviation_score: 0, confirmed_deviation: false, distance_from_route: 0,
    risk: 0, risk_255: 0, label: 'Normal',
  })

  // Refs
  const mapDivRef      = useRef(null)
  const mapRef         = useRef(null)
  const dirSvcRef      = useRef(null)
  const dirRendRef     = useRef(null)
  const markerRef      = useRef(null)
  const destMarkerRef  = useRef(null)
  const timerRef       = useRef(null)
  const overdueRef     = useRef(false)
  const stopDetRef     = useRef(new StopDetector({ speedThreshold: 1.0, minFrames: 3 }))
  const devDetRef      = useRef(new RouteDeviationDetector([], { deviationThresholdMeters: 200, minFrames: 3 }))
  const prevPointRef   = useRef(null)
  const watchIdRef     = useRef(null)

  const {
    sensorFrame,
    setGpsFeatures: storeSetGps,
    applicationMode,
    sendWsMessage,
    routeStatus,
    setRouteStatus,
  } = useSafetyStore()
  const { lat, lon } = sensorFrame.location
  const totalSec = durationMin * 60
  const isCabMode = applicationMode === 'cab'

  // ── Load Google Maps once ──────────────────────────────────────────────────
  useEffect(() => {
    loadMapsAPI()
      .then(() => setMapsReady(true))
      .catch(() => toast.error('Google Maps failed to load — check API key'))
  }, [])

  useEffect(() => {
    if (!routeStatus) return
    if (routeStatus.ok) {
      toast.success(`Backend route synced — ${routeStatus.waypoints} points`)
    } else {
      toast.error(routeStatus.error || 'Backend route sync failed')
    }
    setRouteStatus(null)
  }, [routeStatus, setRouteStatus])

  // ── Init map when container is visible and API is ready ───────────────────
  useEffect(() => {
    if (!mapsReady || !mapDivRef.current || mapRef.current) return
    const gm = window.google.maps
    mapRef.current = new gm.Map(mapDivRef.current, {
      center: { lat: lat || 20.5937, lng: lon || 78.9629 },
      zoom: 15,
      styles: DARK_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
    })
    dirSvcRef.current  = new gm.DirectionsService()
    dirRendRef.current = new gm.DirectionsRenderer({
      map: mapRef.current,
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#22c55e', strokeWeight: 5, strokeOpacity: 0.85 },
    })
  }, [mapsReady, state])

  // ── Live user marker ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !mapRef.current || !lat || !lon) return
    const pos = { lat, lng: lon }
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position: pos,
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Your Location',
        zIndex: 10,
      })
    } else {
      markerRef.current.setPosition(pos)
    }
    if (state === STATES.IDLE) mapRef.current.setCenter(pos)
  }, [lat, lon, mapsReady])

  // ── Fetch route via DirectionsService ─────────────────────────────────────
  const fetchRoute = useCallback(() => {
    if (!mapsReady) return
    if (isCabMode) {
      if (!pickup.trim() || !destination.trim()) {
        toast.error('Enter pickup and drop locations')
        return
      }
    } else if (!destination.trim()) {
      return
    }
    if (!lat || !lon) { toast.error('GPS not ready — wait for location fix'); return }
    setRouteLoading(true)
    const gm = window.google.maps
    const origin = isCabMode ? pickup.trim() : new gm.LatLng(lat, lon)
    const travelMode = isCabMode ? gm.TravelMode.DRIVING : gm.TravelMode.WALKING
    dirSvcRef.current.route({
      origin,
      destination: destination.trim(),
      travelMode,
    }, (result, status) => {
      setRouteLoading(false)
      if (status !== 'OK') { toast.error(`Route error: ${status}`); return }
      dirRendRef.current.setDirections(result)

      // Extract polyline points for custom deviation detector (Haversine math)
      const path = result.routes[0].overview_path
      const routePoints = path.map(p => ({ lat: p.lat(), lon: p.lng() }))
      devDetRef.current.setRoute(routePoints)

      const leg = result.routes?.[0]?.legs?.[0]
      if (isCabMode && leg) {
        const start = [leg.start_location.lat(), leg.start_location.lng()]
        const end = [leg.end_location.lat(), leg.end_location.lng()]
        const sent = sendWsMessage({ type: 'set_route', start, destination: end })
        if (!sent) toast.error('Backend route sync failed — WebSocket offline')
      }

      // Place destination marker
      const destLatLng = result.routes[0].legs[0].end_location
      if (destMarkerRef.current) destMarkerRef.current.setMap(null)
      destMarkerRef.current = new gm.Marker({
        position: destLatLng,
        map: mapRef.current,
        title: destination.trim(),
        icon: { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' },
      })
      mapRef.current.fitBounds(result.routes[0].bounds)
      toast.success(`Route loaded — ${result.routes[0].legs[0].duration.text}`)
    })
  }, [mapsReady, destination, lat, lon, pickup, isCabMode, sendWsMessage])

  // ── GPS processing loop (runs during ACTIVE journey) ──────────────────────
  const processGpsUpdate = useCallback((pos) => {
    const { latitude, longitude, accuracy, timestamp } = pos.coords
    const curr = { lat: latitude, lon: longitude, accuracy, time: timestamp }

    // Step 1: Quality filter
    if (!qualityFilter(curr)) return

    const prev = prevPointRef.current
    let speed = 0, dist = 0, dt = 0

    if (prev) {
      // Step 2: Haversine distance
      dist = haversine(prev, curr)
      // Step 3: Speed
      dt    = (curr.time - prev.time) / 1000  // seconds
      speed = computeSpeed(dist, (curr.time - prev.time))
    }
    prevPointRef.current = curr

    // Step 4: Stop detection (temporal filter)
    const stopResult = stopDetRef.current.update(speed, dt || 1)

    // Step 5: Route deviation (if route loaded)
    const devResult = devDetRef.current.update({ lat: latitude, lon: longitude })

    // Step 6: Normalize & compute risk
    const features = { ...stopResult, ...devResult }
    const riskResult = computeGpsRisk(features)
    const fullFeatures = { ...features, speed, ...riskResult }

    setGpsFeatures(fullFeatures)
    storeSetGps(fullFeatures)  // push to Zustand → picked up by useWebSocket

    // Deviation + stop alert (backend also handles this, this is frontend early warning)
    if (devResult.confirmed_deviation && stopResult.stationary_time > 120) {
      toast.error('⚠️ Stopped away from route for >2 min — check in?', { id: 'dev-stop', duration: 8000 })
    }
  }, [storeSetGps])

  // ── Start journey ──────────────────────────────────────────────────────────
  const startJourney = useCallback(() => {
    if (isCabMode) {
      if (!pickup.trim() || !destination.trim()) { toast.error('Enter pickup and drop locations first'); return }
      if (devDetRef.current.route.length === 0) { toast.error('Load the cab route before starting'); return }
    } else if (!destination.trim()) {
      toast.error('Enter a destination first')
      return
    }
    if (!lat || !lon) { toast.error('GPS not available — wait for fix'); return }

    stopDetRef.current.reset()
    devDetRef.current.reset()
    prevPointRef.current = null
    overdueRef.current   = false

    setState(STATES.ACTIVE)
    setElapsed(0)
    setRemaining(totalSec)
    setAlertsSent(0)
    vibrate(VIBRATE.SENSOR_ON)
    toast.success(`Journey started — ${durationMin} min timer`)

    // Start GPS processing watch
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        processGpsUpdate,
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      )
    }

    // Countdown timer
    timerRef.current = setInterval(() => {
      setElapsed(e => {
        const newE = e + 1
        const rem  = totalSec - newE
        setRemaining(rem)
        if (rem === 120) {
          vibrate(VIBRATE.SUSPICIOUS)
          toast('⚠️ 2 min remaining — tap I Arrived if safe', { duration: 8000 })
        }
        if (rem <= 0 && !overdueRef.current) {
          overdueRef.current = true
          setState(STATES.OVERDUE)
          clearInterval(timerRef.current)
          vibrate(VIBRATE.CRITICAL)
          toast.error('🚨 Journey overdue! Contacts will be alerted.', { duration: 10000 })
          setAlertsSent(a => a + 1)
        }
        return newE
      })
    }, 1000)
  }, [destination, pickup, lat, lon, totalSec, durationMin, processGpsUpdate, isCabMode])

  const markArrived = () => {
    clearInterval(timerRef.current)
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    setState(STATES.ARRIVED)
    vibrate(VIBRATE.CONFIRM)
    toast.success('✅ Journey complete — contacts notified!')
    setTimeout(() => setState(STATES.IDLE), 5000)
  }

  const cancelJourney = () => {
    clearInterval(timerRef.current)
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    stopDetRef.current.reset()
    devDetRef.current.reset()
    setState(STATES.IDLE)
    vibrate(VIBRATE.CONFIRM)
    toast('Journey cancelled', { icon: '🚫' })
  }

  useEffect(() => () => {
    clearInterval(timerRef.current)
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
  }, [])

  const progress = Math.min(1, elapsed / totalSec)
  const circ     = 2 * Math.PI * 42

  const riskColor = gpsFeatures.label === 'Critical' ? '#ef4444'
    : gpsFeatures.label === 'High'      ? '#f97316'
    : gpsFeatures.label === 'Suspicious' ? '#f59e0b'
    : '#22c55e'

  return (
    <div className="glass rounded-2xl border border-white/10 w-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 p-5 pb-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Navigation size={15} className="text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white">{isCabMode ? 'Cab Route Mode' : 'Journey Mode'}</h3>
          <p className="text-[10px] text-slate-500 font-mono">
            {isCabMode ? 'Pickup/Drop Tracking · Route Deviation · Auto-Alert' : 'GPS Behavior Analysis · Route Deviation · Auto-Alert'}
          </p>
        </div>
        {state === STATES.ACTIVE && (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-[9px] font-mono text-blue-400 font-bold">TRACKING</span>
          </span>
        )}
        {state === STATES.OVERDUE && (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
            <AlertTriangle size={10} className="text-red-400" />
            <span className="text-[9px] font-mono text-red-400 font-bold">OVERDUE</span>
          </span>
        )}
      </div>

      {/* ── Google Map ── */}
      <div
        ref={mapDivRef}
        className="w-full transition-all"
        style={{ height: state === STATES.IDLE ? '200px' : '240px' }}
      />
      {!mapsReady && (
        <div className="flex items-center justify-center h-12 text-slate-500 text-xs font-mono">
          Loading Google Maps…
        </div>
      )}

      <div className="p-5 pt-4 space-y-4">
        <AnimatePresence mode="wait">

          {/* ── IDLE: Setup ── */}
          {state === STATES.IDLE && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex gap-2">
                {isCabMode && (
                  <input
                    value={pickup}
                    onChange={e => setPickup(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchRoute()}
                    placeholder="Pickup location (e.g. City Mall)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 outline-none"
                  />
                )}
                <input
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchRoute()}
                  placeholder={isCabMode ? 'Drop location (e.g. Airport)' : 'Enter destination (e.g. Home, Metro Station…)'}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 outline-none"
                />
                <button
                  onClick={fetchRoute}
                  disabled={routeLoading || !mapsReady}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa' }}
                >
                  {routeLoading ? '…' : <MapPin size={14} />}
                </button>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-2">
                  Duration: <span className="text-blue-400 font-bold">{durationMin} min</span>
                </label>
                <input type="range" min="5" max="120" step="5" value={durationMin}
                  onChange={e => setDurationMin(Number(e.target.value))}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-[9px] text-slate-600 font-mono mt-1">
                  <span>5 min</span><span>30 min</span><span>1 hr</span><span>2 hr</span>
                </div>
              </div>

              <button onClick={startJourney}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa' }}>
                {isCabMode ? '🚖 Start Cab Tracking' : '🚶 Start Journey'}
              </button>
            </motion.div>
          )}

          {/* ── ACTIVE / OVERDUE ── */}
          {(state === STATES.ACTIVE || state === STATES.OVERDUE) && (
            <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

              {/* Circular timer + GPS features */}
              <div className="flex items-center gap-4">
                {/* Timer ring */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={state === STATES.OVERDUE ? '#ef4444' : remaining < 120 ? '#f59e0b' : '#3b82f6'}
                      strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
                      animate={{ strokeDashoffset: circ * (1 - progress) }}
                      transition={{ duration: 0.5 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-mono text-slate-400">
                      {state === STATES.OVERDUE ? 'OVERDUE' : 'left'}
                    </span>
                    <span className={`text-lg font-black font-mono ${
                      state === STATES.OVERDUE ? 'text-red-400' : remaining < 120 ? 'text-amber-400' : 'text-blue-400'
                    }`}>{fmt(remaining)}</span>
                  </div>
                </div>

                {/* GPS Behavioral Features */}
                <div className="flex-1 space-y-2">
                  {/* Speed */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-mono">SPEED</span>
                    <div className="text-right">
                      <span className="text-xs text-white font-bold font-mono">{gpsFeatures.speed.toFixed(1)} m/s</span>
                      <span className="text-[9px] text-slate-500 font-mono ml-1">{speedLabel(gpsFeatures.speed)}</span>
                    </div>
                  </div>
                  {/* Stop */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-mono">STOPPED</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white font-mono">{fmt(gpsFeatures.stationary_time)}</span>
                      {gpsFeatures.confirmed_stop && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-full">CONFIRMED</span>
                      )}
                    </div>
                  </div>
                  {/* Deviation */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-mono">OFF-ROUTE</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white font-mono">{gpsFeatures.distance_from_route} m</span>
                      {gpsFeatures.confirmed_deviation && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-full">DEVIATED</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1">
                    <Activity size={10} /> GPS Behavioral Risk
                  </span>
                  <span className="text-[10px] font-bold font-mono" style={{ color: riskColor }}>
                    {gpsFeatures.label} ({gpsFeatures.risk_255}/255)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: riskColor }}
                    animate={{ width: `${(gpsFeatures.risk_255 / 255) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <p className="text-[9px] text-slate-600 font-mono">
                  stop_score={gpsFeatures.stop_score?.toFixed(2)} · deviation_score={gpsFeatures.deviation_score?.toFixed(2)}
                </p>
              </div>

              {/* Destination */}
              <p className="text-xs text-slate-400 font-mono truncate">→ {destination}</p>
              {alertsSent > 0 && <p className="text-[10px] text-red-400 font-mono">🚨 {alertsSent} alert(s) dispatched</p>}

              {/* Controls */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={markArrived}
                  className="py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e' }}>
                  <CheckCircle size={15} /> I Arrived ✓
                </button>
                <button onClick={cancelJourney}
                  className="py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  <XCircle size={15} /> Cancel
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ARRIVED ── */}
          {state === STATES.ARRIVED && (
            <motion.div key="arrived" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-3 py-6">
              <CheckCircle size={48} className="text-green-400" />
              <p className="text-green-400 font-bold text-lg">Arrived Safely!</p>
              <p className="text-slate-500 text-xs font-mono">GPS tracking stopped</p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
