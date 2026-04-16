import React from 'react'
import { ScrollText, AlertTriangle, Clock, Activity, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSafetyStore } from './safetyStore'
import { formatDistanceToNow } from 'date-fns'

const LEVEL_COLORS = {
  SAFE:       '#22c55e',
  SUSPICIOUS: '#f59e0b',
  HIGH:       '#f97316',
  CRITICAL:   '#ef4444',
}

function LogEntry({ snap, idx }) {
  const color = LEVEL_COLORS[snap.threatLevel]
  const timeStr = new Date(snap.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="group flex gap-4 py-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.01] transition-colors px-2 rounded-xl"
    >
      {/* Time & Level Dot */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-1">
         <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
         <div className="w-[1px] flex-1 bg-white/5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between">
           <span className="text-[10px] font-black tracking-widest uppercase" style={{ color }}>{snap.threatLevel}</span>
           <span className="text-[9px] font-mono text-slate-600">{timeStr}</span>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex flex-col">
              <span className="text-xs font-bold text-white/90">{Math.round(snap.combinedScore)}</span>
              <span className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">SCORE</span>
           </div>
           {snap.trend && (
             <div className="flex flex-col">
                <span className={`text-[10px] font-black ${snap.trend === 'UP' ? 'text-red-400' : 'text-slate-500'}`}>{snap.trend}</span>
                <span className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">TREND</span>
             </div>
           )}
           {snap.alertTriggered && (
              <div className="ml-auto px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[8px] font-black text-red-500 animate-pulse uppercase tracking-widest">
                 Alert Fired
              </div>
           )}
        </div>
      </div>

      {/* Mini Profile Bars */}
      <div className="flex gap-1 items-end h-8 pt-2">
         {['location', 'time', 'motion', 'audio'].map((key) => {
            const val = snap.inputs?.[key] || 0
            return (
              <div key={key} className="w-1 rounded-full bg-white/5 relative overflow-hidden h-full">
                 <div 
                   className="absolute bottom-0 w-full rounded-full" 
                   style={{ height: `${(val/255)*100}%`, background: color, opacity: 0.4 }}
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

  return (
    <div className="glass rounded-[2rem] p-6 border border-white/5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/5 text-slate-500">
             <Activity size={14} />
          </div>
          <h2 className="font-display font-black text-xs tracking-widest text-white/80 uppercase italic">Live Event Stream</h2>
        </div>
        <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-mono text-slate-500">
           {history.length} PKTS
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20">
             <Zap size={32} className="mb-2" />
             <p className="text-[10px] text-white font-black uppercase tracking-widest">Waiting for packets</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {history.map((snap, i) => (
              <LogEntry key={snap.timestamp} snap={snap} idx={i} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
