import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSafetyStore } from './safetyStore'
import { AlertCircle, ShieldCheck, ShieldAlert, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const STATE_ORDER = ['SAFE', 'SUSPICIOUS', 'HIGH', 'CRITICAL']
const STATE_COLORS = {
  SAFE:       '#22c55e',
  SUSPICIOUS: '#f59e0b',
  HIGH:       '#f97316',
  CRITICAL:   '#ef4444',
}
const STATE_LABELS = {
  SAFE:       'SYSTEM SECURE',
  SUSPICIOUS: 'ANOMALY DETECTED',
  HIGH:       'HIGH THREAT',
  CRITICAL:   'EMERGENCY ESCALATION',
}

function GaugeArc({ pct, color }) {
  const r = 85
  const cx = 100, cy = 100
  const circumference = Math.PI * r   // half circle
  const dashOffset = circumference * (1 - pct)

  return (
    <svg width="200" height="110" viewBox="0 0 200 110" className="overflow-visible">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="12" strokeLinecap="round"
      />
      {/* Secondary Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeLinecap="round" transform="translate(0, 4)"
      />
      {/* Fill */}
      <motion.path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: dashOffset }}
        transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ filter: `drop-shadow(0 0 15px ${color}60)` }}
      />
    </svg>
  )
}

export default function ThreatIndicator() {
  const { threatLevel, combinedScore, movingAvg, recommendation, trend, getThreatMeta } = useSafetyStore()
  const meta = getThreatMeta()
  const color = STATE_COLORS[threatLevel]
  const pct   = combinedScore / 255

  const TrendIcon = trend === 'UP' ? TrendingUp : trend === 'DOWN' ? TrendingDown : Minus

  return (
    <motion.div
      className="glass rounded-[2.5rem] p-8 relative overflow-hidden group border-2"
      style={{ borderColor: `${color}40`, boxShadow: `0 0 60px ${color}15` }}
      animate={{ 
        borderColor: `${color}30`,
        scale: threatLevel === 'CRITICAL' ? [1, 1.01, 1] : 1
      }}
      transition={{ duration: 0.5, repeat: threatLevel === 'CRITICAL' ? Infinity : 0 }}
    >
      <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none" />
      
      {/* Scanline Effect for Critical */}
      {threatLevel === 'CRITICAL' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <div className="w-full h-1 bg-red-500/20 top-0 absolute animate-scanline" />
        </div>
      )}

      {/* Background glow */}
      <motion.div
        className="absolute inset-x-0 top-0 h-32 opacity-20 pointer-events-none"
        animate={{ background: `radial-gradient(circle at 50% 0%, ${color}, transparent 70%)` }}
      />

      <div className="flex flex-col lg:flex-row items-center gap-10 relative z-10">

        {/* ── Left: Gauge ── */}
        <div className="relative flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
          <GaugeArc pct={pct} color={color} />
          
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
            <motion.div 
               className="flex items-baseline"
               animate={{ color }}
            >
              <span className="font-display font-black text-6xl tracking-tighter">
                {Math.round(combinedScore)}
              </span>
            </motion.div>
            <div className="flex items-center gap-1.5 opacity-40">
               <div className="w-1 h-1 rounded-full bg-white" />
               <span className="text-[10px] font-mono tracking-widest text-white uppercase">Risk Index</span>
            </div>
          </div>

          {/* Critical Pulse */}
          <AnimatePresence>
            {threatLevel === 'CRITICAL' && (
              <motion.div
                className="absolute inset-0 rounded-full border-4"
                style={{ borderColor: color }}
                initial={{ opacity: 0.5, scale: 0.8 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ── Center: Status & Intelligence ── */}
        <div className="flex-1 text-center lg:text-left">
          <div className="flex flex-col lg:flex-row items-center lg:items-end gap-3 mb-2">
            <motion.h1
              className="font-display font-black text-4xl sm:text-5xl tracking-tighter"
              animate={{ color }}
            >
              {STATE_LABELS[threatLevel]}
            </motion.h1>
            <div className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest border mb-1.5 ${trend === 'UP' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-white/5 border-white/10 text-slate-500'}`}>
               {trend}
            </div>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed max-w-md font-medium opacity-80 mb-6">
            {recommendation}
          </p>

          {/* FSM Stepper */}
          <div className="flex justify-center lg:justify-start gap-3">
            {STATE_ORDER.map((s, i) => {
              const active = s === threatLevel
              const past = STATE_ORDER.indexOf(s) < STATE_ORDER.indexOf(threatLevel)
              return (
                <div key={s} className="relative group/step">
                   <motion.div
                     className="h-1.5 rounded-full overflow-hidden bg-white/5"
                     style={{ width: active ? '60px' : '30px' }}
                     animate={{ 
                       width: active ? 64 : 32,
                       background: active || past ? STATE_COLORS[s] : 'rgba(255,255,255,0.05)'
                     }}
                   />
                   <span className={`absolute -bottom-4 left-0 text-[8px] font-black tracking-tighter ${active ? 'text-white' : 'text-slate-700'} uppercase`}>
                     {s.slice(0,4)}
                   </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right: Temporal Stability ── */}
        <div className="flex flex-col gap-4">
           <div className="glass bg-white/[0.03] rounded-3xl p-6 border border-white/5 flex flex-col items-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Stability</span>
              <motion.div className="font-display font-black text-3xl" animate={{ color }}>
                 {Math.round(movingAvg)}
              </motion.div>
              <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-500">
                 <Zap size={10} className="text-amber-400" />
                 <span>TEMPORAL MEAN</span>
              </div>
           </div>
        </div>

      </div>
    </motion.div>
  )
}
