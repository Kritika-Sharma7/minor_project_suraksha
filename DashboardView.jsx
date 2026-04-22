import React from 'react'
import ThreatIndicator from './ThreatIndicator'
import RiskChart from './RiskChart'
import HistoryLog from './HistoryLog'
import ThreatMap from './ThreatMap'
import { useSafetyStore } from './safetyStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, BrainCircuit, Activity, ShieldAlert,
  TrendingUp, TrendingDown, Minus,
  Mic, Smartphone, MapPin, Clock,
  Users, Car,
} from 'lucide-react'

// ── Mode-specific sensor priority config ──────────────────────────────────────

const WOMEN_SENSORS = [
  {
    key: 'audio',
    label: 'Audio',
    icon: Mic,
    role: 'PRIMARY',
    roleColor: '#ef4444',
    description: 'Distress keywords + voice energy',
    tip: 'Say "help", "bachao", "chhodo" to trigger',
  },
  {
    key: 'motion',
    label: 'Motion',
    icon: Smartphone,
    role: 'SECONDARY',
    roleColor: '#f97316',
    description: 'Fall, jerk, struggle patterns',
    tip: 'Sudden acceleration spike → danger signal',
  },
  {
    key: 'time',
    label: 'Time Context',
    icon: Clock,
    role: 'CONTEXT',
    roleColor: '#f59e0b',
    description: 'Night-time sensitivity boost',
    tip: '20:00–06:00 → elevated thresholds',
  },
  {
    key: 'gps',
    label: 'GPS',
    icon: MapPin,
    role: 'LIGHT',
    roleColor: '#64748b',
    description: 'Location for alert sharing only',
    tip: 'Not a threat signal in Women mode',
  },
]

const CAB_SENSORS = [
  {
    key: 'gps',
    label: 'GPS / Route',
    icon: MapPin,
    role: 'PRIMARY',
    roleColor: '#ef4444',
    description: 'Route deviation + stop behaviour',
    tip: '200m off-route × 3 frames → confirmed',
  },
  {
    key: 'stop',
    label: 'Stop Behaviour',
    icon: Car,
    role: 'SECONDARY',
    roleColor: '#f97316',
    description: 'Unusual stops — duration + location',
    tip: 'Stopped off-route > 2 min → DANGER',
  },
  {
    key: 'audio',
    label: 'Audio',
    icon: Mic,
    role: 'SUPPORT',
    roleColor: '#f59e0b',
    description: 'Distress signals inside the cab',
    tip: 'Lower weight than Women mode',
  },
  {
    key: 'time',
    label: 'Time Context',
    icon: Clock,
    role: 'CONTEXT',
    roleColor: '#64748b',
    description: 'Night-time sensitivity boost',
    tip: '20:00–06:00 → elevated thresholds',
  },
]

// ── Live sensor value helpers ─────────────────────────────────────────────────

function useSensorValues() {
  const { sensorFrame, sensorsEnabled, gpsFeatures, reliability, speechActive } = useSafetyStore()
  const { location, motion, audio } = sensorFrame

  // Audio display: getUserMedia may fail on Windows Chrome (exclusive SR mic lock).
  // If SpeechRecognition is active (speechActive), the mic IS online for keyword detection
  // even when rms stays 0. Show that state clearly instead of "Waiting…".
  const audioOnline = sensorsEnabled.microphone
  const audioValue = audio.rms > 0
    ? `RMS ${audio.rms.toFixed(3)}`
    : audioOnline
      ? (speechActive ? 'Listening…' : 'Ready')
      : 'Waiting…'
  const audioSub = audio.keyword_detected
    ? `Keyword: "${audio.keyword}"`
    : audio.rms > 0.25
      ? 'High energy'
      : audioOnline
        ? 'Keyword detection active'
        : 'Mic offline'

  return {
    gps: {
      active:  sensorsEnabled.location,
      value:   location.lat ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : 'Waiting…',
      quality: reliability.gps,
      sub:     gpsFeatures.confirmed_deviation ? '⚠ Route deviation' :
               gpsFeatures.confirmed_stop      ? '⚠ Stationary stop' : 'Normal',
    },
    stop: {
      active:  sensorsEnabled.location,
      value:   gpsFeatures.stationary_time > 0 ? `${Math.round(gpsFeatures.stationary_time)}s stopped` : 'Moving',
      quality: reliability.gps,
      sub:     gpsFeatures.deviation_score > 0 ? `Dev: ${(gpsFeatures.deviation_score * 100).toFixed(0)}%` : '',
    },
    audio: {
      active:  audioOnline,
      value:   audioValue,
      quality: reliability.audio,
      sub:     audioSub,
    },
    motion: {
      active:  sensorsEnabled.motion,
      value:   motion.accelMag > 0 ? `${motion.accelMag.toFixed(2)} m/s²` : 'Waiting…',
      quality: reliability.motion,
      sub:     motion.shakeScore > 0.3 ? 'Shake detected' :
               motion.fallProb > 0.5  ? '⚠ Fall risk'    : 'Stable',
    },
    time: {
      active:  true,
      value:   new Date().toLocaleTimeString(),
      quality: 1.0,
      sub:     (() => { const h = new Date().getHours(); return (h >= 20 || h <= 6) ? 'Night — +20 risk' : 'Day — normal' })(),
    },
  }
}

// ── Sensor Row ────────────────────────────────────────────────────────────────

function SensorRow({ sensor, liveValues }) {
  const live    = liveValues[sensor.key] || {}
  const Icon    = sensor.icon
  const quality = live.quality ?? 1

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${sensor.roleColor}18` }}
      >
        <Icon size={16} style={{ color: sensor.roleColor }} />
      </div>

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-white">{sensor.label}</span>
          <span
            className="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded"
            style={{ background: `${sensor.roleColor}20`, color: sensor.roleColor }}
          >
            {sensor.role}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 truncate">{sensor.description}</p>
      </div>

      {/* Live reading */}
      <div className="text-right flex-shrink-0 min-w-[90px]">
        <div className={`text-[11px] font-mono font-bold ${live.active ? 'text-slate-200' : 'text-slate-600'}`}>
          {live.value || '—'}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">{live.sub}</div>
      </div>

      {/* Quality bar */}
      <div className="w-1 h-8 bg-white/5 rounded-full overflow-hidden flex-shrink-0">
        <motion.div
          className="w-full rounded-full"
          style={{ background: quality > 0.6 ? '#22c55e' : quality > 0.2 ? '#f59e0b' : '#ef4444' }}
          animate={{ height: `${quality * 100}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </motion.div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardView() {
  const { reasons, confidence, threatLevel, trend, getThreatMeta, applicationMode } = useSafetyStore()
  const meta       = getThreatMeta()
  const liveValues = useSensorValues()

  const sensors    = applicationMode === 'cab' ? CAB_SENSORS : WOMEN_SENSORS
  const isWomen    = applicationMode === 'women'

  const TrendIcon = { UP: TrendingUp, DOWN: TrendingDown, STABLE: Minus }[trend || 'STABLE']

  return (
    <div className="flex flex-col xl:flex-row gap-8 min-h-screen pb-12">

      {/* ── Main Panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-8">

        {/* Mode banner */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border"
          style={{
            background: isWomen ? 'rgba(78,222,163,0.06)' : 'rgba(96,165,250,0.06)',
            borderColor: isWomen ? 'rgba(78,222,163,0.2)' : 'rgba(96,165,250,0.2)',
          }}
        >
          {isWomen
            ? <Users size={16} className="text-primary" />
            : <Car   size={16} className="text-blue-400" />}
          <span
            className="text-xs font-bold tracking-widest"
            style={{ color: isWomen ? '#4edea3' : '#60a5fa' }}
          >
            {isWomen ? 'WOMEN SAFETY MODE — Audio & Motion are primary signals' : 'CAB SAFETY MODE — GPS Route deviation is the primary signal'}
          </span>
        </div>

        {/* Live Threat Indicator */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert size={20} className="text-primary animate-pulse" />
            <h2 className="text-lg font-display font-black tracking-tighter text-white/90">LIVE THREAT VECTOR</h2>
          </div>
          <ThreatIndicator />
        </section>

        {/* Timeline + Map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Activity size={18} className="text-secondary" />
              <h2 className="text-sm font-display font-bold tracking-widest text-white/70">
                PROBABILISTIC TIMELINE
              </h2>
            </div>
            <RiskChart />
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert size={18} className="text-cyan-400" />
              <h2 className="text-sm font-display font-bold tracking-widest text-white/70">
                SPATIAL RISK MAP
              </h2>
            </div>
            <ThreatMap />
          </section>
        </div>

        {/* Sensor Fusion Matrix */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <BrainCircuit size={18} className="text-primary" />
            <h2 className="text-sm font-display font-bold tracking-widest text-white/70">
              SENSOR FUSION MATRIX
            </h2>
            <span className="text-[10px] text-slate-600 font-mono">
              {isWomen ? 'Audio × 0.55 + Motion × 0.35 + GPS × 0.10' : 'GPS × 0.65 + Audio × 0.25 + Motion × 0.10'}
            </span>
          </div>
          <div className="space-y-2">
            {sensors.map((sensor, i) => (
              <motion.div
                key={sensor.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <SensorRow sensor={sensor} liveValues={liveValues} />
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Insights Panel ─────────────────────────────────────────────── */}
      <div className="w-full xl:w-96 flex flex-col gap-8">

        {/* Quick vitals */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-4 border border-white/5 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Confidence</span>
              <BrainCircuit size={14} className="text-primary" />
            </div>
            <div>
              <span className="text-4xl font-display font-black text-white">{confidence}%</span>
              <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  animate={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 border border-white/5 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Trend</span>
              <TrendIcon size={14} className={trend === 'UP' ? 'text-red-400' : 'text-slate-400'} />
            </div>
            <div>
              <span className={`text-2xl font-display font-black ${trend === 'UP' ? 'text-red-400' : 'text-white'}`}>
                {trend}
              </span>
              <p className="text-[9px] text-slate-500 font-mono mt-2">vs. moving average</p>
            </div>
          </div>
        </div>

        {/* Explainability */}
        <div
          className="glass rounded-3xl p-6 border shadow-2xl relative overflow-hidden"
          style={{ borderColor: `${meta.color}20` }}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Sparkles size={80} />
          </div>

          <div className="flex items-center gap-2 mb-5">
            <Sparkles size={16} className="text-secondary" />
            <h3 className="font-display font-bold text-xs tracking-[0.2em] text-white/80">
              SYSTEM EXPLAINABILITY
            </h3>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="wait">
              {reasons && reasons.length > 0 ? (
                reasons.map((r, i) => (
                  <motion.div
                    key={r}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex gap-3 items-start p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: meta.color }}
                    />
                    <span className="text-xs font-medium text-slate-300 leading-relaxed">{r}</span>
                  </motion.div>
                ))
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] text-slate-500 text-xs italic">
                  <Activity size={14} className="animate-pulse" />
                  Scanning real-time sensor vectors…
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Activity feed */}
        <div className="flex-1 min-h-[360px]">
          <HistoryLog />
        </div>

      </div>
    </div>
  )
}
