import React from 'react'
import { ScrollText, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSafetyStore } from '../store/safetyStore'
import { formatDistanceToNow } from 'date-fns'

const LEVEL_COLORS = {
  SAFE:       '#22c55e',
  SUSPICIOUS: '#f59e0b',
  HIGH:       '#f97316',
  CRITICAL:   '#ef4444',
}

const LEVEL_DOT = {
  SAFE:       'bg-green-500',
  SUSPICIOUS: 'bg-amber-500',
  HIGH:       'bg-orange-500',
  CRITICAL:   'bg-red-500',
}

function LogEntry({ snap, idx }) {
  const color = LEVEL_COLORS[snap.threatLevel]
  const ago   = formatDistanceToNow(new Date(snap.timestamp), { addSuffix: true })

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.03 }}
      className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0"
    >
      {/* Dot + line */}
      <div className="flex flex-col items-center mt-1 flex-shrink-0">
        <div
          className={`w-2 h-2 rounded-full ${LEVEL_DOT[snap.threatLevel]}`}
          style={{ boxShadow: `0 0 6px ${color}80` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="font-display font-bold text-xs"
            style={{ color }}
          >
            {snap.threatLevel}
          </span>
          {snap.alertTriggered && (
            <span className="flex items-center gap-0.5 text-[9px] text-red-400 font-mono">
              <AlertTriangle size={9} /> ALERT
            </span>
          )}
        </div>
        <div className="flex gap-3 text-[10px] text-slate-500 font-mono mt-0.5">
          <span>Score: <span className="text-slate-300">{Math.round(snap.combinedScore)}</span></span>
          <span>Avg: <span className="text-slate-300">{Math.round(snap.movingAvg)}</span></span>
        </div>
        <p className="text-[9px] text-slate-600 mt-0.5">{ago}</p>
      </div>

      {/* Mini sparkline of inputs */}
      <div className="flex gap-0.5 items-end h-6 flex-shrink-0">
        {[snap.inputs?.location, snap.inputs?.time, snap.inputs?.motion, snap.inputs?.audio].map((v, i) => (
          <div
            key={i}
            className="w-1.5 rounded-sm"
            style={{
              height: `${Math.max(4, ((v || 0) / 255) * 24)}px`,
              background: LEVEL_COLORS[snap.threatLevel],
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

export default function HistoryLog() {
  const { history } = useSafetyStore()

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ScrollText size={14} className="text-slate-400" />
          <h2 className="font-display font-bold text-sm tracking-widest text-white">EVENT LOG</h2>
        </div>
        <span className="text-[10px] font-mono text-slate-600">{history.length} events</span>
      </div>

      <div className="h-64 overflow-y-auto pr-1">
        {history.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-slate-600 font-mono">No events yet — run analysis</p>
          </div>
        ) : (
          <AnimatePresence>
            {history.map((snap, i) => (
              <LogEntry key={snap.timestamp} snap={snap} idx={i} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
