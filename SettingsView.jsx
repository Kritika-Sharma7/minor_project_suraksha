import React from 'react'
import { Settings2, UserCog, Volume2, Fingerprint, Radar, Sliders, ShieldCheck, Zap, Cog } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import { motion } from 'framer-motion'

export default function SettingsView() {
  const { applicationMode, setApplicationMode, profile, setProfile, weights } = useSafetyStore()

  const MODES = [
    { id: 'women', label: 'WOMEN SAFETY', desc: 'Focuses on isolation and acoustic distress signatures.', color: 'primary' },
    { id: 'elderly', label: 'ELDERLY CARE', desc: 'High-sensitivity fall detection and vertical velocity monitoring.', color: 'secondary' },
    { id: 'industrial', label: 'INDUSTRIAL', desc: 'Machinery noise filtering and chaotic motion detection.', color: 'blue' }
  ]

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
        
        {/* ── Operation Modes (Left 2 cols) ────────────────── */}
        <div className="xl:col-span-2 space-y-8">
           <div className="glass rounded-[2.5rem] p-10 border border-white/5">
              <div className="flex items-center gap-3 mb-10">
                 <UserCog className="text-primary" />
                 <h3 className="text-sm font-display font-black text-white/90 uppercase tracking-widest italic">Target Environment Mode</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {MODES.map((mode) => (
                  <motion.div 
                    key={mode.id} 
                    whileHover={{ y: -5 }}
                    onClick={() => setApplicationMode(mode.id)}
                    className={`rounded-[2rem] p-8 border-2 cursor-pointer transition-all flex flex-col h-full bg-gradient-to-br ${
                      applicationMode === mode.id 
                        ? 'from-primary/10 to-transparent border-primary shadow-[0_0_40px_rgba(78,222,163,0.1)]' 
                        : 'from-white/[0.02] to-transparent border-white/5 hover:border-white/10 opacity-60'
                    }`}
                  >
                    <div className="mb-4">
                       <span className={`text-[10px] font-black tracking-widest ${applicationMode === mode.id ? 'text-primary' : 'text-slate-500'} transition-colors`}>
                          {applicationMode === mode.id ? 'SELECTED' : 'INACTIVE'}
                       </span>
                    </div>
                    <h3 className="text-xl font-display font-black text-white mb-2 uppercase tracking-tighter">{mode.label}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed flex-1">{mode.desc}</p>
                    {applicationMode === mode.id && (
                       <div className="mt-8 flex justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                       </div>
                    )}
                  </motion.div>
                ))}
              </div>
           </div>

           {/* Sensitivity Matrix */}
           <div className="glass rounded-[2.5rem] p-10 border border-white/5">
              <div className="flex items-center gap-3 mb-10">
                 <Sliders className="text-secondary" />
                 <h3 className="text-sm font-display font-black text-white/90 uppercase tracking-widest italic">Adaptive Weight Matrix</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 {[
                   { id: 'location', label: 'Geo-Spatial Influence', val: weights.location },
                   { id: 'time', label: 'Temporal Drift Factor', val: weights.time },
                   { id: 'motion', label: 'Kinetic Momentum', val: weights.motion },
                   { id: 'audio', label: 'Acoustic Entropy', val: weights.audio }
                 ].map(w => (
                   <div key={w.id} className="space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                         <span className="text-slate-500">{w.label}</span>
                         <span className="text-white">{Math.round(w.val * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                         <motion.div 
                           className="h-full bg-secondary"
                           animate={{ width: `${w.val * 100}%` }}
                         />
                      </div>
                   </div>
                 ))}
              </div>
              <div className="mt-10 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-4">
                 <Zap size={14} className="text-amber-400 mt-1" />
                 <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                   Wait matrices are dynamically recalibrated by the FSM based on the selected Operation Mode. Manual override requires Administrator privileges.
                 </p>
              </div>
           </div>
        </div>

        {/* ── Sidebar: Thresholds (Right) ────────────────── */}
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
                      onChange={(e) => setProfile({...profile, alert_threshold: Number(e.target.value)})}
                      className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-primary"
                    />
                    <div className="flex justify-between mt-2 text-[9px] text-slate-600 font-mono tracking-widest">
                       <span>LOW SENSITIVITY</span>
                       <span>MAX RESPONSE</span>
                    </div>
                 </div>

                 <div className="space-y-6 pt-6 border-t border-white/5">
                    <div className="flex justify-between items-center">
                       <span className="text-[11px] font-medium text-slate-500">Continuous Logging</span>
                       <div className="w-10 h-5 rounded-full bg-primary/20 border border-primary/40 flex items-center px-1">
                          <div className="w-3 h-3 rounded-full bg-primary ml-auto shadow-[0_0_8px_#4edea3]" />
                       </div>
                    </div>
                    <div className="flex justify-between items-center opacity-40 grayscale">
                       <span className="text-[11px] font-medium text-slate-500">Biometric Verification</span>
                       <div className="w-10 h-5 rounded-full bg-white/5 border border-white/10 flex items-center px-1">
                          <div className="w-3 h-3 rounded-full bg-slate-600" />
                       </div>
                    </div>
                 </div>
              </div>
           </div>

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
