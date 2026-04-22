/**
 * gpsProcessor.js — Real-Time GPS Geospatial Behavior Analysis Pipeline
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║              3-LAYER SIGNAL PROCESSING ARCHITECTURE              ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  SIGNAL LAYER  │ Raw GPS data from navigator.geolocation         ║
 * ║                │   (lat, lon, accuracy, timestamp)               ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  FEATURE LAYER │ Derived behavioral signals (custom math only)   ║
 * ║                │   • distance        — Haversine (metres)        ║
 * ║                │   • speed           — distance / Δt (m/s)       ║
 * ║                │   • stationary_time — cumulative seconds stopped ║
 * ║                │   • distance_from_route — raw geometric (metres) ║
 * ║                │   • stop_score      — normalized 0–1            ║
 * ║                │   • deviation_score — normalized 0–1            ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  DECISION LAYER│ Temporally confirmed behavioral events          ║
 * ║                │   • confirmed_stop      (≥ 3 consecutive frames)║
 * ║                │   • confirmed_deviation (≥ 3 consecutive frames)║
 * ║                │   • risk / risk_255 / label                     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * BEHAVIOR INTERPRETATION:
 *   Speed + stop_detection + route_deviation together represent the
 *   user's physical movement behavior pattern. A combination of
 *   low speed, prolonged stationary time, and confirmed route deviation
 *   models the behavioral signature of a user in potential danger.
 *
 * ALL distance/speed/deviation computations are custom-implemented.
 * Google Maps SDK is used ONLY for map rendering (polyline, markers).
 */

// ── HAVERSINE DISTANCE ────────────────────────────────────────────────────────

/**
 * Computes great-circle distance between two GPS points using the
 * Haversine formula. Accurate to within ~0.5% for distances < 1000 km.
 *
 * @param {{lat: number, lon: number}} p1
 * @param {{lat: number, lon: number}} p2
 * @returns {number} distance in meters
 */
export function haversine(p1, p2) {
  const R     = 6371000 // Earth radius in metres
  const toRad = x => x * Math.PI / 180

  const dLat = toRad(p2.lat - p1.lat)
  const dLon = toRad(p2.lon - p1.lon)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) *
    Math.cos(toRad(p2.lat)) *
    Math.sin(dLon / 2) ** 2

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── GPS QUALITY FILTER ────────────────────────────────────────────────────────

/**
 * Rejects low-quality GPS readings (accuracy > 50 m = noise).
 * @param {{accuracy?: number}} point
 * @returns {boolean} true = usable, false = discard
 */
export function qualityFilter(point) {
  if (!point) return false
  if (point.accuracy == null) return true
  return point.accuracy <= 50
}

// ── SPEED COMPUTATION ─────────────────────────────────────────────────────────

/**
 * Computes instantaneous speed in m/s.
 * Returns 0 if time gap is unreasonably large (app was backgrounded).
 *
 * @param {number} distanceMeters
 * @param {number} dtMs   time delta in milliseconds
 * @returns {number} speed in m/s
 */
export function computeSpeed(distanceMeters, dtMs) {
  if (dtMs <= 0 || dtMs > 30_000) return 0
  return distanceMeters / (dtMs / 1000)
}

/**
 * Human-readable label for a speed value (m/s).
 *   0 – 0.5  m/s → Stationary
 *   0.5 – 1  m/s → Very Slow
 *   1 – 2.5  m/s → Walking  (typical: 1.4 m/s)
 *   2.5 – 5  m/s → Fast Walk / Jog
 *   5 – 10   m/s → Running
 *   10+      m/s → Vehicle
 */
export function speedLabel(speed) {
  if (speed < 0.5)  return 'Stationary'
  if (speed < 1.0)  return 'Very Slow'
  if (speed < 2.5)  return 'Walking'
  if (speed < 5.0)  return 'Fast Walk'
  if (speed < 10.0) return 'Running'
  return 'Vehicle'
}

// ── STOP DETECTOR ─────────────────────────────────────────────────────────────

export class StopDetector {
  constructor({ speedThreshold = 1.0, minFrames = 3 } = {}) {
    this.speedThreshold = speedThreshold
    this.minFrames      = minFrames
    this.stationaryTime = 0
    this.stopFrameCount = 0
    this.confirmed_stop = false
  }

  update(speed, dt) {
    if (speed < this.speedThreshold) {
      this.stationaryTime += dt
      this.stopFrameCount++
    } else {
      this.stationaryTime = Math.max(0, this.stationaryTime - dt * 0.5)
      this.stopFrameCount = 0
    }

    // Decision Layer: FRAME COUNT ONLY — do not mix stationary_time into gate
    this.confirmed_stop = this.stopFrameCount >= this.minFrames

    // Feature Layer: continuous normalized score, separate from binary decision
    const stop_score = Math.min(this.stationaryTime / 300, 1.0)

    return {
      stationary_time: Math.round(this.stationaryTime), // Feature Layer
      stop_score:      parseFloat(stop_score.toFixed(4)), // Feature Layer
      confirmed_stop:  this.confirmed_stop,              // Decision Layer
    }
  }

  reset() {
    this.stationaryTime = 0
    this.stopFrameCount = 0
    this.confirmed_stop = false
  }
}

// ── ROUTE DEVIATION DETECTOR ──────────────────────────────────────────────────

export class RouteDeviationDetector {
  constructor(route = [], { deviationThresholdMeters = 200, minFrames = 3 } = {}) {
    this.route               = route
    this.threshold           = deviationThresholdMeters
    this.minFrames           = minFrames
    this.deviation_count     = 0
    this.confirmed_deviation = false
    this.distance_from_route = 0
  }

  setRoute(route) {
    this.route = route
    this.reset()
  }

  computeDistance(point) {
    if (!this.route || this.route.length === 0) return 0
    let minDist = Infinity
    for (const rp of this.route) {
      const d = haversine(point, rp)
      if (d < minDist) minDist = d
    }
    return minDist
  }

  update(point) {
    // Signal Layer → Feature Layer
    // distance_from_route: raw geometric signal (metres), NOT normalized
    const distance_from_route = this.computeDistance(point)
    this.distance_from_route  = distance_from_route

    // Feature Layer: normalize to 0–1
    const deviation_score = Math.min(distance_from_route / this.threshold, 1.0)

    // Temporal filter (frame counter)
    if (distance_from_route > this.threshold) {
      this.deviation_count++
    } else {
      this.deviation_count = Math.max(0, this.deviation_count - 1)
    }

    // Decision Layer: pure frame-count gate
    this.confirmed_deviation = this.deviation_count >= this.minFrames

    return {
      distance_from_route: Math.round(distance_from_route), // Signal Layer: raw geometry
      deviation_score:     parseFloat(deviation_score.toFixed(4)), // Feature Layer
      confirmed_deviation: this.confirmed_deviation,              // Decision Layer
    }
  }

  reset() {
    this.deviation_count     = 0
    this.confirmed_deviation = false
    this.distance_from_route = 0
  }
}

// ── RISK ENGINE ───────────────────────────────────────────────────────────────

/**
 * Computes GPS behavioral risk (Decision Layer output, 0–1 scale).
 *
 * Behavior interpretation:
 *   speed + stop_detection + route_deviation model user movement behavior.
 *   confirmed_deviation + stationary_time > 120 s = "stopped at wrong place"
 *   (strongest behavioral danger signal in this pipeline)
 */
export function computeGpsRisk(features) {
  const {
    stop_score = 0,              // Feature Layer
    deviation_score = 0,         // Feature Layer
    confirmed_deviation = false, // Decision Layer
    stationary_time = 0,         // Feature Layer
  } = features

  let risk = 0.30 * deviation_score + 0.25 * stop_score

  if (confirmed_deviation && stationary_time > 120) {
    risk += 0.30  // stopped at wrong place > 2 min
  }

  risk = Math.min(1.0, risk)

  let label = 'Normal'
  if (risk >= 0.70)      label = 'Critical'
  else if (risk >= 0.45) label = 'High'
  else if (risk >= 0.20) label = 'Suspicious'

  return {
    risk:     parseFloat(risk.toFixed(4)), // Decision Layer: 0–1
    risk_255: Math.round(risk * 255),      // Decision Layer: 0–255 (backend scale)
    label,                                 // Decision Layer: threat class
  }
}
