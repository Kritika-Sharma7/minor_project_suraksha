import React from 'react'
import { Shield, Wifi, WifiOff, Users, Car, RotateCcw } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import { resetEngine } from './apiClient'
import toast from 'react-hot-toast'

export default function Header() {
  const {
    wsConnected,
    threatLevel,
    getThreatMeta,
    applicationMode,
    setApplicationMode,
    sensorsEnabled,
  } = useSafetyStore()

  const meta = getThreatMeta()

  const savedProfile = (() => {
    try { return JSON.parse(localStorage.getItem('suraksha_profile') || '{}') } catch { return {} }
  })()

  const handleReset = async () => {
    try {
      await resetEngine()
      window.location.reload()
    } catch {
      toast.error('Reset failed')
    }
  }

  const sensorCount = Object.values(sensorsEnabled).filter(Boolean).length

  return (
    <header className="flex items-center justify-between gap-4 flex-wrap">

      {/* ── Logo + User ── */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center relative flex-shrink-0"
          style={{ background: `${meta.color}20`, border: `1.5px solid ${meta.color}50` }}
        >
          <Shield size={20} style={{ color: meta.color }} />
          {threatLevel === 'CRITICAL' && (
            <span
              className="absolute inset-0 rounded-xl ping-red"
              style={{ background: meta.color, opacity: 0.3 }}
            />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-base text-white tracking-wider leading-none">
            SURAKSHA
          </h1>
          {savedProfile.name ? (
            <p className="text-xs text-slate-500 font-mono truncate">
              {savedProfile.name}
            </p>
          ) : (
            <p className="text-xs text-slate-500 font-mono">Safety Intelligence v3</p>
          )}
        </div>
      </div>

      {/* ── Mode Switcher ── */}
      <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/10">
        <button
          onClick={() => setApplicationMode('women')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            applicationMode === 'women'
              ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(78,222,163,0.15)]'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
        >
          <Users size={14} />
          Women Safety
        </button>
        <button
          onClick={() => setApplicationMode('cab')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            applicationMode === 'cab'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_12px_rgba(96,165,250,0.15)]'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
        >
          <Car size={14} />
          Cab Mode
        </button>
      </div>

      {/* ── Status cluster ── */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Sensor count pill */}
        <div className="flex items-center gap-1.5 glass rounded-lg px-3 py-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${sensorCount > 0 ? 'bg-primary animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-xs font-mono text-slate-400">
            {sensorCount}/3 sensors
          </span>
        </div>

        {/* WebSocket connection */}
        <div className="flex items-center gap-1.5 glass rounded-lg px-3 py-1.5">
          {wsConnected
            ? <Wifi size={14} className="text-safe" />
            : <WifiOff size={14} className="text-slate-500" />}
          <span
            className="text-xs font-mono"
            style={{ color: wsConnected ? '#22c55e' : '#64748b' }}
          >
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {/* Threat state badge */}
        <div
          className="rounded-lg px-3 py-1.5 font-display text-xs font-bold tracking-widest"
          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}
        >
          {threatLevel}
        </div>

        {/* Reset FSM */}
        <button
          onClick={handleReset}
          title="Reset threat engine"
          className="glass rounded-lg p-2 text-slate-500 hover:text-white transition-colors"
        >
          <RotateCcw size={14} />
        </button>
      </div>

    </header>
  )
}
