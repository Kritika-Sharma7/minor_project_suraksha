import React from 'react'
import ThreatIndicator from './ThreatIndicator'
import RiskChart from './RiskChart'
import InputDashboard from './InputDashboard'
import HistoryLog from './HistoryLog'
import ThreatMap from './ThreatMap'
import { useSafetyStore } from './safetyStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, BrainCircuit, Activity, ShieldAlert, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function DashboardView() {
  const { reasons, confidence, threatLevel, trend, getThreatMeta } = useSafetyStore()
  const meta = getThreatMeta()

  const TrendIcon = {
    'UP': TrendingUp,
    'DOWN': TrendingDown,
    'STABLE': Minus
  }[trend || 'STABLE']

  return (
    <div className="flex flex-col xl:flex-row gap-8 min-h-screen pb-12">
      
      {/* ── Main Panel (Left/Center) ────────────────── */}
      <div className="flex-1 flex flex-col gap-8">
        
        {/* Core Threat Status */}
        <section className="relative">
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert size={20} className="text-primary animate-pulse" />
            <h2 className="text-lg font-display font-black tracking-tighter text-white/90">LIVE THREAT VECTOR</h2>
          </div>
          <ThreatIndicator />
        </section>

        {/* Temporal Reasoning & Geospatial */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Activity size={18} className="text-secondary" />
              <h2 className="text-sm font-display font-bold tracking-widest text-white/70">PROBABILISTIC TIMELINE</h2>
            </div>
            <RiskChart />
          </section>
          
          <section>
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert size={18} className="text-cyan-400" />
              <h2 className="text-sm font-display font-bold tracking-widest text-white/70">SPATIAL RISK MAP</h2>
            </div>
            <ThreatMap />
          </section>
        </div>

        {/* Sensor Fusion Matrix */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <BrainCircuit size={18} className="text-primary" />
            <h2 className="text-sm font-display font-bold tracking-widest text-white/70">SENSOR FUSION MATRIX</h2>
          </div>
          <InputDashboard />
        </section>
      </div>

      {/* ── Insights Panel (Right) ────────────────── */}
      <div className="w-full xl:w-96 flex flex-col gap-8">
        
        {/* Quick Vitals */}
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
                <p className="text-[9px] text-slate-500 font-mono mt-2">Divergence from baseline</p>
             </div>
          </div>
        </div>

        {/* Explainability Engine */}
        <div 
          className="glass rounded-3xl p-6 border shadow-2xl relative overflow-hidden" 
          style={{ borderColor: `${meta.color}20` }}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5">
             <Sparkles size={80} />
          </div>
          
          <div className="flex items-center gap-2 mb-6">
            <Sparkles size={16} className="text-secondary" />
            <h3 className="font-display font-bold text-xs tracking-[0.2em] text-white/80">SYSTEM EXPLAINABILITY</h3>
          </div>
          
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {reasons && reasons.length > 0 ? (
                reasons.map((r, i) => (
                  <motion.div 
                    key={r}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4 items-start p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
                  >
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: meta.color }} />
                    <span className="text-xs font-medium text-slate-300 leading-relaxed">{r}</span>
                  </motion.div>
                ))
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] text-slate-500 text-xs italic">
                  <Activity size={14} className="animate-pulse" /> Scanning real-time vectors...
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="flex-1 min-h-[400px]">
           <HistoryLog />
        </div>

      </div>
    </div>
  )
}
