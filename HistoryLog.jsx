import React from 'react'
import { Activity, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSafetyStore } from './safetyStore'

const LEVEL_COLORS = {
  SAFE:       '#22c55e',
  SUSPICIOUS: '#f59e0b',
  HIGH:       '#f97316',
  CRITICAL:   '#ef4444',
}

function LogEntry({ snap, idx }) {
  const color     = LEVEL_COLORS[snap.threatLevel] ?? '#60a5fa'
  const isThreat  = snap.threatLevel !== 'SAFE'
  const timeStr   = new Date(snap.timestamp).toLocaleTimeString([], {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(idx * 0.04, 0.3) }}
      className={`group flex gap-4 py-3 border-b border-white/[0.03] last:border-0 transition-colors px-2 rounded-xl ${
        isThreat ? 'bg-white/[0.02]' : ''
      }`}
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-1">
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: isThreat ? `0 0 8px ${color}` : 'none' }}
        />
        <div className="w-[1px] flex-1 bg-white/5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black tracking-widest uppercase" style={{ color }}>
            {snap.threatLevel}
          </span>
          <span className="text-[9px] font-mono text-slate-600 flex-shrink-0">{timeStr}</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white/90">{Math.round(snap.combinedScore)}</span>
            <span className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">SCORE</span>
          </div>

          {snap.trend && (
            <div className="flex flex-col">
              <span className={`text-[10px] font-black ${snap.trend === 'UP' ? 'text-red-400' : 'text-slate-500'}`}>
                {snap.trend}
              </span>
              <span className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">TREND</span>
            </div>
          )}

          {/* Keyword badge — only shown when a distress keyword was active */}
          {snap.keyword && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[8px] font-black text-amber-400 uppercase tracking-widest">
              "{snap.keyword}"
            </span>
          )}

          {snap.alertTriggered && (
            <span className="ml-auto px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[8px] font-black text-red-500 animate-pulse uppercase tracking-widest">
              SOS FIRED
            </span>
          )}
        </div>

        {/* Top reason — only for threat entries */}
        {isThreat && snap.reasons?.[0] && (
          <p className="text-[9px] text-slate-500 font-mono truncate leading-relaxed">
            {snap.reasons[0]}
          </p>
        )}
      </div>

      {/* Mini sensor bars */}
      <div className="flex gap-1 items-end h-8 pt-2 flex-shrink-0">
        {['location', 'time', 'motion', 'audio'].map((key) => {
          const val = snap.inputs?.[key] || 0
          return (
            <div key={key} className="w-1 rounded-full bg-white/5 relative overflow-hidden h-full">
              <div
                className="absolute bottom-0 w-full rounded-full"
                style={{ height: `${(val / 100) * 100}%`, background: color, opacity: isThreat ? 0.6 : 0.3 }}
              />
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

export default function HistoryLog() {
  const { history } = useSafetyStore()

  const threats  = history.filter(h => h.threatLevel !== 'SAFE')
  const safes    = history.filter(h => h.threatLevel === 'SAFE')

  return (
    <div className="glass rounded-[2rem] p-6 border border-white/5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/5 text-slate-500">
            <Activity size={14} />
          </div>
          <h2 className="font-display font-black text-xs tracking-widest text-white/80 uppercase italic">
            Live Event Stream
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {threats.length > 0 && (
            <span className="px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-[9px] font-black text-red-400">
              {threats.length} ALERTS
            </span>
          )}
          <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-mono text-slate-500">
            {history.length} ENTRIES
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20">
            <Zap size={32} className="mb-2" />
            <p className="text-[10px] text-white font-black uppercase tracking-widest">Waiting for events</p>
            <p className="text-[9px] text-slate-600 font-mono mt-1">Updates on state change or every 60s</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {/* Threats first (pinned to top), then SAFE entries */}
            {[...threats, ...safes].map((snap, i) => (
              <LogEntry key={snap.timestamp} snap={snap} idx={i} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
