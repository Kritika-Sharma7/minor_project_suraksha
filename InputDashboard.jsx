import React from 'react'
import { MapPin, Clock, Activity, Mic, Waves, Shield, Terminal, Zap, Info, TrendingUp } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import { motion } from 'framer-motion'

function SignalCard({ title, value, icon: Icon, desc, active, reliability = 1.0, color = 'primary' }) {
  const pct = value // Risk is 0-100
  const reliabilityPct = Math.round(reliability * 100)
  
  return (
    <div
      className="glass rounded-2xl p-4 border relative overflow-hidden transition-all duration-300 group hover:bg-white/[0.02]"
      style={{ borderColor: active ? `var(--${color}-color)40` : 'rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${active ? 'bg-primary/10' : 'bg-white/5'}`}>
            <Icon size={14} className={active ? 'text-primary' : 'text-slate-500'} />
          </div>
          <p className="text-[10px] text-white font-black tracking-widest uppercase opacity-70">{title}</p>
        </div>
        <div className="flex items-center gap-1.5">
           <div className="flex h-1.5 w-6 gap-0.5 items-end">
              {[0.2, 0.4, 0.6, 0.8].map(h => (
                <div 
                  key={h} 
                  className={`flex-1 rounded-sm ${reliability >= h ? 'bg-primary' : 'bg-white/10'}`} 
                  style={{ height: `${h * 100}%` }}
                />
              ))}
           </div>
           <span className="text-[8px] font-black text-slate-500 font-mono tracking-tighter">{reliabilityPct}%</span>
        </div>
      </div>
      
      <div className="flex items-end justify-between mb-4 relative z-10">
        <span className="font-display text-4xl font-black text-white">{Math.round(value)}</span>
        <span className="text-[10px] text-slate-500 font-mono">STRESS LVL</span>
      </div>

      <p className="text-[10px] text-slate-400 font-medium mb-3 min-h-[2rem] leading-tight relative z-10">{desc}</p>
      
      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative z-10">
         <motion.div 
           className="h-full bg-primary"
           initial={{ width: 0 }}
           animate={{ width: `${pct}%` }}
           style={{ filter: `drop-shadow(0 0 5px var(--primary-color))` }}
         />
      </div>
    </div>
  )
}

export default function InputDashboard() {
  const {
    locationRisk,
    timeRisk,
    motionRisk,
    audioRisk,
    sensorFrame,
    sensorsEnabled,
    backgroundMonitoring,
    setBackgroundMonitoring,
    profile,
    riskDelta,
    liveEvents,
    trend,
    getThreatMeta,
    reliability
  } = useSafetyStore()

  const meta = getThreatMeta()

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SignalCard
          title="GPS Logic"
          value={locationRisk}
          icon={MapPin}
          desc={sensorFrame.location.lat ? `±${sensorFrame.location.accuracy.toFixed(0)}m accuracy | ${sensorFrame.location.speed || 0} km/h` : 'Calibrating GPS...'}
          active={sensorsEnabled.location}
          reliability={reliability.gps}
        />
        <SignalCard
          title="Temporal"
          value={timeRisk}
          icon={Clock}
          desc={`Security Cycle: ${timeRisk > 10 ? 'Nocturnal Mode' : 'Standard Dial'}`}
          active
          reliability={1.0}
        />
        <SignalCard
          title="Motion Lab"
          value={motionRisk}
          icon={Activity}
          desc={`Acc: ${sensorFrame.motion.accelMag.toFixed(2)}m/s² | Shake: ${sensorFrame.motion.shakeScore.toFixed(0)}`}
          active={sensorsEnabled.motion}
          reliability={reliability.motion}
        />
        <SignalCard
          title="Acoustics"
          value={audioRisk}
          icon={Mic}
          desc={`ZCR: ${sensorFrame.audio.zcr.toFixed(3)} | RMS: ${sensorFrame.audio.rms.toFixed(3)}`}
          active={sensorsEnabled.microphone}
          reliability={reliability.audio}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Momentum Indicator */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-2 mb-3">
             <TrendingUp size={14} className="text-secondary" />
             <h3 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">MOMENTUM</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-display font-black ${riskDelta > 0 ? 'text-red-400' : 'text-primary'}`}>
               {riskDelta > 0 ? '+' : ''}{Math.round(riskDelta)}
            </span>
            <span className="text-[10px] font-mono text-slate-600">Points / sec</span>
          </div>
        </div>

        {/* Intelligence Feed */}
        <div className="lg:col-span-2 glass rounded-2xl p-5 border border-white/5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
             <Terminal size={14} className="text-primary" />
             <h3 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">EVENT DETECTED</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
             {liveEvents.length > 0 ? (
               liveEvents.map(e => (
                 <span key={e} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-white/80 tracking-widest">
                   {e}
                 </span>
               ))
             ) : (
               <span className="text-[10px] font-mono text-slate-600 italic flex items-center gap-2">
                 <Zap size={10} className="animate-pulse" /> SYSTEM IDLE • MONITORING CHANNELS
               </span>
             )}
          </div>
        </div>
      </div>
    </div>
  )
}
