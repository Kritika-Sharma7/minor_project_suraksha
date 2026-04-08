import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSafetyStore } from '../store/safetyStore'

const STATE_ORDER = ['SAFE', 'SUSPICIOUS', 'HIGH', 'CRITICAL']
const STATE_COLORS = {
  SAFE:       '#22c55e',
  SUSPICIOUS: '#f59e0b',
  HIGH:       '#f97316',
  CRITICAL:   '#ef4444',
}
const STATE_LABELS = {
  SAFE:       'System Secure',
  SUSPICIOUS: 'Anomaly Detected',
  HIGH:       'High Alert',
  CRITICAL:   'EMERGENCY',
}

function GaugeArc({ pct, color }) {
  const r = 70
  const cx = 90, cy = 90
  const circumference = Math.PI * r   // half circle
  const dashOffset = circumference * (1 - pct)

  return (
    <svg width="180" height="100" viewBox="0 0 180 100" className="overflow-visible">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round"
      />
      {/* Fill */}
      <motion.path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: dashOffset }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      {/* Glow track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"
        opacity={0.2}
      />
    </svg>
  )
}

export default function ThreatIndicator() {
  const { threatLevel, combinedScore, movingAvg, recommendation, getThreatMeta } = useSafetyStore()
  const meta = getThreatMeta()
  const color = STATE_COLORS[threatLevel]
  const pct   = combinedScore / 255

  return (
    <motion.div
      className="glass rounded-2xl p-6 relative overflow-hidden"
      style={{ borderColor: `${color}30` }}
      animate={{ borderColor: `${color}30` }}
      transition={{ duration: 0.5 }}
    >
      {/* Background glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{ background: `radial-gradient(ellipse at 50% 0%, ${color}08 0%, transparent 70%)` }}
        transition={{ duration: 0.5 }}
      />

      <div className="flex flex-col sm:flex-row items-center gap-6">

        {/* Gauge */}
        <div className="relative flex-shrink-0">
          <GaugeArc pct={pct} color={color} />
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
            <motion.span
              className="font-display font-bold text-3xl leading-none"
              animate={{ color }}
              transition={{ duration: 0.4 }}
            >
              {Math.round(combinedScore)}
            </motion.span>
            <span className="text-xs text-slate-500 font-mono">/255</span>
          </div>
          {/* Critical pulse rings */}
          <AnimatePresence>
            {threatLevel === 'CRITICAL' && (
              <>
                {[0, 0.3, 0.6].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border"
                    style={{ borderColor: color }}
                    initial={{ opacity: 0.6, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.5 }}
                    transition={{ duration: 1.5, delay, repeat: Infinity }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>
        </div>

        {/* State info */}
        <div className="flex-1 text-center sm:text-left">
          <motion.p
            className="font-display font-bold text-2xl sm:text-3xl tracking-wider"
            animate={{ color }}
            transition={{ duration: 0.4 }}
          >
            {STATE_LABELS[threatLevel]}
          </motion.p>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed max-w-sm">
            {recommendation}
          </p>

          {/* FSM state steps */}
          <div className="flex gap-2 mt-4">
            {STATE_ORDER.map((s) => {
              const isActive  = s === threatLevel
              const isPast    = STATE_ORDER.indexOf(s) < STATE_ORDER.indexOf(threatLevel)
              const stateColor = STATE_COLORS[s]
              return (
                <div key={s} className="flex flex-col items-center gap-1">
                  <motion.div
                    className="w-2 h-2 rounded-full"
                    animate={{
                      background: isActive || isPast ? stateColor : 'rgba(255,255,255,0.1)',
                      boxShadow:  isActive ? `0 0 8px ${stateColor}` : 'none',
                    }}
                    transition={{ duration: 0.3 }}
                  />
                  <span className="text-[9px] font-mono text-slate-600">{s.slice(0, 4)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Moving average */}
        <div className="flex-shrink-0 text-center">
          <div className="glass rounded-xl px-5 py-3">
            <p className="text-[10px] text-slate-500 font-mono mb-1">MOVING AVG</p>
            <motion.p
              className="font-display font-bold text-xl"
              animate={{ color }}
            >
              {Math.round(movingAvg)}
            </motion.p>
            <p className="text-[10px] text-slate-600 font-mono">5-sample window</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
