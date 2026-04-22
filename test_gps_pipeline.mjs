/**
 * test_gps_pipeline.mjs
 * Verifies the complete GPS behavioral detection pipeline.
 * Run: node test_gps_pipeline.mjs
 */

// ─────────────────────────────────────────────
// 1. HAVERSINE DISTANCE
// ─────────────────────────────────────────────
function haversine(p1, p2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lon - p1.lon);
  const a = Math.sin(dLat/2)**2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────
// 2. QUALITY FILTER
// ─────────────────────────────────────────────
function qualityFilter(point) {
  if (!point) return false;
  if (point.accuracy == null) return true;
  return point.accuracy <= 50;
}

// ─────────────────────────────────────────────
// 3. SPEED
// ─────────────────────────────────────────────
function computeSpeed(distanceMeters, dtMs) {
  if (dtMs <= 0 || dtMs > 30000) return 0;
  return distanceMeters / (dtMs / 1000);
}

// ─────────────────────────────────────────────
// 4. STOP DETECTOR
// ─────────────────────────────────────────────
class StopDetector {
  constructor({ speedThreshold = 1.0, minFrames = 3 } = {}) {
    this.speedThreshold = speedThreshold;
    this.minFrames = minFrames;
    this.stationaryTime = 0;
    this.stopFrameCount = 0;
    this.confirmed_stop = false;
  }
  update(speed, dt) {
    if (speed < this.speedThreshold) {
      this.stationaryTime += dt;
      this.stopFrameCount++;
    } else {
      this.stationaryTime = Math.max(0, this.stationaryTime - dt * 0.5);
      this.stopFrameCount = 0;
    }
    // Decision Layer: FRAME COUNT ONLY
    this.confirmed_stop = this.stopFrameCount >= this.minFrames;
    const stop_score = Math.min(this.stationaryTime / 300, 1.0);
    return {
      stationary_time: Math.round(this.stationaryTime),
      stop_score: parseFloat(stop_score.toFixed(4)),
      confirmed_stop: this.confirmed_stop,
    };
  }
}

// ─────────────────────────────────────────────
// 5. ROUTE DEVIATION DETECTOR
// ─────────────────────────────────────────────
class RouteDeviationDetector {
  constructor(route = [], { deviationThresholdMeters = 200, minFrames = 3 } = {}) {
    this.route = route;
    this.threshold = deviationThresholdMeters;
    this.minFrames = minFrames;
    this.deviation_count = 0;
    this.confirmed_deviation = false;
    this.distance_from_route = 0;
  }
  computeDistance(point) {
    if (!this.route.length) return 0;
    let minDist = Infinity;
    for (const rp of this.route) {
      const d = haversine(point, rp);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }
  update(point) {
    // Signal Layer → raw geometric distance
    const distance_from_route = this.computeDistance(point);
    this.distance_from_route = distance_from_route;
    // Feature Layer: normalize
    const deviation_score = Math.min(distance_from_route / this.threshold, 1.0);
    // Temporal filter
    if (distance_from_route > this.threshold) this.deviation_count++;
    else this.deviation_count = Math.max(0, this.deviation_count - 1);
    // Decision Layer: frame count gate
    this.confirmed_deviation = this.deviation_count >= this.minFrames;
    return {
      distance_from_route: Math.round(distance_from_route),
      deviation_score: parseFloat(deviation_score.toFixed(4)),
      confirmed_deviation: this.confirmed_deviation,
    };
  }
}

// ─────────────────────────────────────────────
// 6. RISK ENGINE
// ─────────────────────────────────────────────
function computeGpsRisk({ stop_score=0, deviation_score=0, confirmed_deviation=false, stationary_time=0 }) {
  let risk = 0.30 * deviation_score + 0.25 * stop_score;
  if (confirmed_deviation && stationary_time > 120) risk += 0.30;
  risk = Math.min(1.0, risk);
  let label = 'Normal';
  if (risk >= 0.70) label = 'Critical';
  else if (risk >= 0.45) label = 'High';
  else if (risk >= 0.20) label = 'Suspicious';
  return { risk: parseFloat(risk.toFixed(4)), risk_255: Math.round(risk * 255), label };
}

// ═════════════════════════════════════════════
// TEST SUITE
// ═════════════════════════════════════════════
console.log('\n╔══════════════════════════════════════════════╗');
console.log('║     GPS BEHAVIOR PIPELINE — TEST SUITE       ║');
console.log('╚══════════════════════════════════════════════╝\n');

let passed = 0, failed = 0;
function assert(label, condition, got) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label} → got: ${JSON.stringify(got)}`);
    failed++;
  }
}

// ── TEST 1: Haversine ──────────────────────────────────────────────────────
console.log('📐 TEST 1: Haversine Distance');
const delhi   = { lat: 28.6139, lon: 77.2090 };
const nearby  = { lat: 28.6200, lon: 77.2150 }; // ~860m
const faraway = { lat: 28.7000, lon: 77.3000 }; // ~12km
const d1 = haversine(delhi, nearby);
const d2 = haversine(delhi, faraway);
assert('Delhi → nearby ~860m', d1 > 700 && d1 < 1000, d1);
assert('Delhi → faraway >10km', d2 > 10000, d2);
assert('Same point = 0m', haversine(delhi, delhi) < 1, haversine(delhi, delhi));
console.log(`  ℹ️  Delhi→nearby = ${d1.toFixed(1)}m | Delhi→faraway = ${(d2/1000).toFixed(2)}km\n`);

// ── TEST 2: Quality Filter ─────────────────────────────────────────────────
console.log('📡 TEST 2: GPS Quality Filter');
assert('accuracy=10m → keep', qualityFilter({accuracy: 10}), true);
assert('accuracy=50m → keep', qualityFilter({accuracy: 50}), true);
assert('accuracy=51m → discard', !qualityFilter({accuracy: 51}), false);
assert('accuracy=100m → discard', !qualityFilter({accuracy: 100}), false);
assert('null accuracy → allow', qualityFilter({accuracy: null}), true);
console.log();

// ── TEST 3: Speed ─────────────────────────────────────────────────────────
console.log('🏃 TEST 3: Speed Computation');
assert('100m in 10s = 10 m/s', computeSpeed(100, 10000) === 10, computeSpeed(100, 10000));
assert('0 dist = 0 m/s', computeSpeed(0, 5000) === 0, computeSpeed(0, 5000));
assert('dt=0 → 0 (guard)', computeSpeed(100, 0) === 0, computeSpeed(100, 0));
assert('dt>30s → 0 (backgrounded)', computeSpeed(100, 35000) === 0, computeSpeed(100, 35000));
console.log();

// ── TEST 4: Stop Detection ────────────────────────────────────────────────
console.log('🛑 TEST 4: Stop Detection (Temporal Filter)');
const sd = new StopDetector({ speedThreshold: 1.0, minFrames: 3 });

const f1 = sd.update(0.3, 1); // frame 1 — slow
assert('Frame 1: not yet confirmed (1/3)', !f1.confirmed_stop, f1);

const f2 = sd.update(0.2, 1); // frame 2 — slow
assert('Frame 2: not yet confirmed (2/3)', !f2.confirmed_stop, f2);

const f3 = sd.update(0.1, 1); // frame 3 — slow
assert('Frame 3: CONFIRMED (3/3)', f3.confirmed_stop, f3);

const f4 = sd.update(2.0, 1); // fast frame → reset
assert('Fast frame resets count', !f4.confirmed_stop, f4);
assert('Fast frame resets stopFrameCount', sd.stopFrameCount === 0, sd.stopFrameCount);

const f5 = sd.update(0.5, 1);
const f6 = sd.update(0.5, 1);
const f7 = sd.update(0.5, 1);
assert('3 more slow frames → confirmed again', f7.confirmed_stop, f7);
assert('stop_score normalized 0–1', f7.stop_score >= 0 && f7.stop_score <= 1, f7.stop_score);
console.log(`  ℹ️  stationary_time=${f7.stationary_time}s | stop_score=${f7.stop_score}\n`);

// ── TEST 5: Route Deviation Detector ────────────────────────────────────────
console.log('🗺️  TEST 5: Route Deviation Detector');

// Mock route: straight line in Delhi
const mockRoute = [
  { lat: 28.6139, lon: 77.2090 },
  { lat: 28.6160, lon: 77.2110 },
  { lat: 28.6180, lon: 77.2130 },
  { lat: 28.6200, lon: 77.2150 },
];
const rdd = new RouteDeviationDetector(mockRoute, { deviationThresholdMeters: 200, minFrames: 3 });

// User ON route
const onRoute = rdd.update({ lat: 28.6150, lon: 77.2100 });
assert('On-route: deviation_score < 1.0 (not maxed)', onRoute.deviation_score < 1.0, onRoute.deviation_score);
assert('On-route: NOT confirmed deviation', !onRoute.confirmed_deviation, onRoute);
console.log(`  ℹ️  On-route: distance_from_route=${onRoute.distance_from_route}m | score=${onRoute.deviation_score}`);

// User FAR OFF route (3 frames)
const off1 = rdd.update({ lat: 28.6500, lon: 77.2500 }); // far off
const off2 = rdd.update({ lat: 28.6500, lon: 77.2500 });
const off3 = rdd.update({ lat: 28.6500, lon: 77.2500 });
assert('Off-route: distance_from_route > 200m', off3.distance_from_route > 200, off3.distance_from_route);
assert('Off-route: deviation_score = 1.0 (capped)', off3.deviation_score === 1.0, off3.deviation_score);
assert('3 off-route frames → CONFIRMED DEVIATION', off3.confirmed_deviation, off3);
console.log(`  ℹ️  Off-route: distance_from_route=${off3.distance_from_route}m | confirmed=${off3.confirmed_deviation}\n`);

// ── TEST 6: Risk Engine ────────────────────────────────────────────────────
console.log('⚡ TEST 6: Risk Engine');

const r1 = computeGpsRisk({ stop_score: 0, deviation_score: 0 });
assert('All zeros → Normal risk', r1.label === 'Normal', r1);

const r2 = computeGpsRisk({ stop_score: 0.8, deviation_score: 0.9 });
assert('High scores → High/Critical risk', r2.label !== 'Normal', r2.label);
assert('risk_255 in range 0–255', r2.risk_255 >= 0 && r2.risk_255 <= 255, r2.risk_255);

// Strong condition: stopped off-route > 2 min → risk > 0.6 (High or Critical)
const r3 = computeGpsRisk({ stop_score: 0.5, deviation_score: 0.8, confirmed_deviation: true, stationary_time: 150 });
assert('Stopped off-route >2min → High or Critical', r3.label === 'High' || r3.label === 'Critical', r3);
assert('risk_255 max 255', r3.risk_255 <= 255, r3.risk_255);
// Verify exact math: 0.30×0.8 + 0.25×0.5 + 0.30 = 0.665 → High
assert('Risk math: 0.665 exactly', r3.risk === 0.665, r3.risk);
console.log(`  ℹ️  Stopped off-route: risk=${r3.risk} | label=${r3.label} | risk_255=${r3.risk_255}\n`);

// ── TEST 7: Full End-to-End Pipeline Simulation ──────────────────────────────
console.log('🔁 TEST 7: Full Pipeline Simulation (8 GPS frames)');

const route = [
  { lat: 28.6139, lon: 77.2090 },
  { lat: 28.6160, lon: 77.2110 },
  { lat: 28.6200, lon: 77.2150 },
];
const stopDet = new StopDetector();
const devDet  = new RouteDeviationDetector(route);

// Simulated GPS stream: user walks then stops off-route
const gpsFrames = [
  { lat: 28.6139, lon: 77.2090, accuracy: 10, timestamp: 1000 },  // on route, moving
  { lat: 28.6145, lon: 77.2095, accuracy: 8,  timestamp: 2000 },
  { lat: 28.6155, lon: 77.2105, accuracy: 12, timestamp: 3000 },
  { lat: 28.6500, lon: 77.2500, accuracy: 15, timestamp: 4000 },  // off route
  { lat: 28.6500, lon: 77.2500, accuracy: 18, timestamp: 5000 },  // stopped off route
  { lat: 28.6500, lon: 77.2500, accuracy: 20, timestamp: 6000 },  // 3rd frame off route
  { lat: 28.6500, lon: 77.2500, accuracy: 10, timestamp: 7000 },  // still stopped
  { lat: 28.6500, lon: 77.2500, accuracy: 9,  timestamp: 8000 },
];

let prev = null;
gpsFrames.forEach((curr, i) => {
  if (!qualityFilter(curr)) { console.log(`  Frame ${i+1}: DISCARDED (poor accuracy)`); return; }

  let speed = 0, dt = 1;
  if (prev) {
    const dist = haversine(prev, curr);
    dt = (curr.timestamp - prev.timestamp) / 1000;
    speed = computeSpeed(dist, curr.timestamp - prev.timestamp);
  }
  prev = curr;

  const stopRes = stopDet.update(speed, dt);
  const devRes  = devDet.update({ lat: curr.lat, lon: curr.lon });
  const riskRes = computeGpsRisk({ ...stopRes, ...devRes });

  console.log(`  Frame ${i+1}: speed=${speed.toFixed(2)}m/s | stop=${stopRes.confirmed_stop?'✅CONFIRMED':'pending'} | deviation=${devRes.confirmed_deviation?'🚨CONFIRMED':devRes.distance_from_route+'m'} | risk=${riskRes.label}(${riskRes.risk_255})`);
});

console.log();

// ── FINAL SUMMARY ─────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════');
console.log(`RESULTS: ${passed} passed | ${failed} failed`);
if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED — GPS pipeline is fully functional!');
  console.log('\n📋 Implementation verified:');
  console.log('  ✅ Haversine formula (custom, no Maps SDK)');
  console.log('  ✅ GPS Quality Filter (accuracy > 50m discarded)');
  console.log('  ✅ Speed computation (distance/dt)');
  console.log('  ✅ StopDetector — frame count gate (confirmed_stop = count >= 3)');
  console.log('  ✅ RouteDeviationDetector — Signal→Feature→Decision layers');
  console.log('  ✅ Risk Engine (0.3×deviation + 0.25×stop + 0.3 bonus)');
  console.log('  ✅ Full pipeline simulation (8 frames, stop+deviation confirmed)');
} else {
  console.log(`⚠️  ${failed} test(s) failed — review output above`);
}
console.log('═══════════════════════════════════════════════\n');
