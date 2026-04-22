import React from 'react'
import { Settings2, UserCog, Volume2, Fingerprint, Radar, Sliders, ShieldCheck, Zap, Cog, MapPin, Activity, Clock } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import { motion } from 'framer-motion'

const MODES = [
  {
    id: 'women',
    label: 'WOMEN SAFETY',
    desc: 'Focuses on isolation and acoustic distress signatures.',
    detail: 'Audio keyword detection + voice energy as primary threat signal.',
    color: 'primary',
  },
  {
    id: 'cab',
    label: 'CAB SAFETY',
    desc: 'Route deviation tracking with pickup/drop monitoring.',
    detail: 'GPS route analysis as primary signal; stops off-route trigger danger compound.',
    color: 'secondary',
  },
]

const SENSOR_META = {
  audio: {
    label: 'Acoustic Entropy',
    icon: Volume2,
    color: '#4edea3',
    priority: { women: 'PRIMARY', cab: 'SUPPORT' },
  },
  motion: {
    label: 'Kinetic Momentum',
    icon: Activity,
    color: '#f59e0b',
    priority: { women: 'SECONDARY', cab: 'MINIMAL' },
  },
  location: {
    label: 'Geo-Spatial Influence',
    icon: MapPin,
    color: '#60a5fa',
    priority: { women: 'SUPPORT', cab: 'PRIMARY' },
  },
  time: {
    label: 'Temporal Drift Factor',
    icon: Clock,
    color: '#a78bfa',
    priority: { women: 'CONTEXT', cab: 'CONTEXT' },
  },
}

export default function SettingsView() {
  const { applicationMode, setApplicationMode, profile, setProfile, weights } = useSafetyStore()

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-24">

      {/* ── Header ────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Cog className="text-primary" />
            <span className="text-xs font-black tracking-[0.3em] text-slate-500 uppercase">Engine Calibration Layer</span>
          </div>
          <h1 className="text-5xl font-display font-black tracking-tighter text-white">CORE SETTINGS</h1>
          <p className="text-slate-400 mt-4 max-w-2xl font-medium leading-relaxed">
            Fine-tune the neural-symbolic threat engine. Adjust sensor weights, operation modes, and dispatch thresholds for your specific deployment context.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* ── Left: Operation Mode + Weight Matrix ────────────────── */}
        <div className="xl:col-span-2 space-y-8">

          {/* Mode Selection */}
          <div className="glass rounded-[2.5rem] p-10 border border-white/5">
            <div className="flex items-center gap-3 mb-10">
              <UserCog className="text-primary" />
              <h3 className="text-sm font-display font-black text-white/90 uppercase tracking-widest italic">Target Environment Mode</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MODES.map((mode) => {
                const isActive = applicationMode === mode.id
                return (
                  <motion.div
                    key={mode.id}
                    whileHover={{ y: -5 }}
                    onClick={() => setApplicationMode(mode.id)}
                    className={`rounded-[2rem] p-8 border-2 cursor-pointer transition-all flex flex-col h-full bg-gradient-to-br ${
                      isActive
                        ? `from-${mode.color}/10 to-transparent border-${mode.color} shadow-[0_0_40px_rgba(78,222,163,0.1)]`
                        : 'from-white/[0.02] to-transparent border-white/5 hover:border-white/10 opacity-60'
                    }`}
                  >
                    <div className="mb-4">
                      <span className={`text-[10px] font-black tracking-widest ${isActive ? `text-${mode.color}` : 'text-slate-500'} transition-colors`}>
                        {isActive ? 'SELECTED' : 'INACTIVE'}
                      </span>
                    </div>
                    <h3 className="text-xl font-display font-black text-white mb-2 uppercase tracking-tighter">{mode.label}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{mode.desc}</p>
                    <p className="text-[10px] text-slate-600 font-medium leading-relaxed mt-2 flex-1">{mode.detail}</p>
                    {isActive && (
                      <div className="mt-8 flex justify-center">
                        <div className={`w-1.5 h-1.5 rounded-full bg-${mode.color} animate-ping`} />
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Weight Matrix */}
          <div className="glass rounded-[2.5rem] p-10 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <Sliders className="text-primary" />
              <h3 className="text-sm font-display font-black text-white/90 uppercase tracking-widest italic">Adaptive Weight Matrix</h3>
            </div>
            <p className="text-[10px] text-slate-600 font-medium mb-10">
              Active FSM weights for <span className="text-primary">{applicationMode === 'women' ? 'WOMEN SAFETY' : 'CAB SAFETY'}</span> mode
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {(['audio', 'motion', 'location', 'time']).map((key) => {
                const meta = SENSOR_META[key]
                const Icon = meta.icon
                const val = weights[key] ?? 0
                const priority = meta.priority[applicationMode]
                return (
                  <div key={key} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Icon size={12} style={{ color: meta.color }} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{meta.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold tracking-wider" style={{ color: meta.color }}>{priority}</span>
                        <span className="text-white text-[10px] font-black">{Math.round(val * 100)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: meta.color }}
                        animate={{ width: `${val * 100}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-10 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-4">
              <Zap size={14} className="text-amber-400 mt-1 shrink-0" />
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                Weight matrices are dynamically recalibrated by the FSM based on the selected Operation Mode. Manual override requires Administrator privileges.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Dispatch Logic + Engine Integrity ────────────────── */}
        <div className="space-y-8">
          <div className="glass rounded-[2.5rem] p-8 border border-white/5">
            <div className="flex items-center gap-3 mb-8">
              <Radar className="text-primary" />
              <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Dispatch Logic</h3>
            </div>

            <div className="space-y-10">
              <div>
                <div className="flex justify-between items-end mb-4">
                  <span className="text-xs font-bold text-white uppercase tracking-tight">SOS Trigger</span>
                  <span className="text-2xl font-display font-black text-primary">{profile.alert_threshold}</span>
                </div>
                <input
                  type="range" min="150" max="250" step="1" value={profile.alert_threshold}
                  onChange={(e) => setProfile({ ...profile, alert_threshold: Number(e.target.value) })}
                  className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-primary"
                />
                <div className="flex justify-between mt-2 text-[9px] text-slate-600 font-mono tracking-widest">
                  <span>LOW SENSITIVITY</span>
                  <span>MAX RESPONSE</span>
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-white/5">
                {/* Continuous Logging — always on */}
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400">Continuous Logging</span>
                    <p className="text-[9px] text-slate-600 mt-0.5">All sensor frames persisted</p>
                  </div>
                  <div className="w-10 h-5 rounded-full bg-primary/20 border border-primary/40 flex items-center px-1 cursor-not-allowed">
                    <div className="w-3 h-3 rounded-full bg-primary ml-auto shadow-[0_0_8px_#4edea3]" />
                  </div>
                </div>

                {/* Background Monitoring */}
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400">Background Monitoring</span>
                    <p className="text-[9px] text-slate-600 mt-0.5">Sensors active when app is backgrounded</p>
                  </div>
                  <div className="w-10 h-5 rounded-full bg-primary/20 border border-primary/40 flex items-center px-1">
                    <div className="w-3 h-3 rounded-full bg-primary ml-auto shadow-[0_0_8px_#4edea3]" />
                  </div>
                </div>

                {/* Biometric Verification — not yet implemented */}
                <div className="flex justify-between items-center opacity-35">
                  <div>
                    <span className="text-[11px] font-medium text-slate-500">Biometric Verification</span>
                    <p className="text-[9px] text-slate-600 mt-0.5">Requires hardware support</p>
                  </div>
                  <div className="w-10 h-5 rounded-full bg-white/5 border border-white/10 flex items-center px-1 cursor-not-allowed">
                    <div className="w-3 h-3 rounded-full bg-slate-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Engine Integrity */}
          <div className="glass rounded-[2.5rem] p-8 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <ShieldCheck size={100} />
            </div>
            <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4">ENGINE INTEGRITY</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium mb-6">
              Your configuration is encrypted and stored locally. Periodic syncs with the decision cluster ensure FSM logic parity.
            </p>
            <div className="flex items-center gap-2 text-[9px] font-black text-primary tracking-widest">
              <Fingerprint size={12} /> VERIFIED SECURE
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
