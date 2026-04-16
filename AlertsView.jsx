import React from 'react'
import { BellRing, Mail, Smartphone, ShieldAlert, Send, Clock, Users, ChevronRight, Zap } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import { motion } from 'framer-motion'

export default function AlertsView() {
  const { alertTriggered, lastAlertTime } = useSafetyStore()

  const contacts = [
    { name: 'Emergency Services', type: 'Primary', status: 'Standby', icon: ShieldAlert, color: 'red' },
    { name: 'Emergency Contact 1', type: 'SMS/Voice', status: 'Ready', icon: Smartphone, color: 'blue' },
    { name: 'Emergency Contact 2', type: 'Email', status: 'Ready', icon: Mail, color: 'orange' }
  ]

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-24">
      
      {/* ── Header ────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BellRing className="text-secondary" />
            <span className="text-xs font-black tracking-[0.3em] text-slate-500 uppercase">Emergency Dispatch Protocol</span>
          </div>
          <h1 className="text-5xl font-display font-black tracking-tighter text-white">RESPONSE CENTER</h1>
          <p className="text-slate-400 mt-4 max-w-2xl font-medium leading-relaxed">
             Review automated dispatch history and manage fail-safe communication channels for critical events.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ── Left: Contact Management ────────────────── */}
        <div className="lg:col-span-1 space-y-6">
           <div className="glass rounded-[2rem] p-8 border border-white/5">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-sm font-display font-black tracking-widest text-white/70 uppercase italic">Dispatch Matrix</h3>
                 <Users size={16} className="text-slate-500" />
              </div>

              <div className="space-y-4">
                 {contacts.map(c => (
                   <div key={c.name} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-white/10 transition-colors cursor-pointer">
                      <div className={`p-3 rounded-xl bg-${c.color}-500/10 text-${c.color}-400`}>
                         <c.icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="text-xs font-black text-white/90 truncate uppercase tracking-tight">{c.name}</div>
                         <div className="text-[10px] text-slate-500 font-mono mt-0.5">{c.type}</div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10">
                         <div className="w-1 h-1 rounded-full bg-green-400" />
                         <span className="text-[8px] font-black text-slate-500 uppercase">{c.status}</span>
                      </div>
                   </div>
                 ))}
              </div>

              <button className="w-full mt-8 py-4 px-6 rounded-[1.2rem] bg-white text-black font-display font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors">
                 Manage Recipients
              </button>
           </div>
        </div>

        {/* ── Right: Alert Log ────────────────── */}
        <div className="lg:col-span-2 flex flex-col">
           <div className={`glass rounded-[2.5rem] p-12 flex-1 flex flex-col items-center justify-center text-center gap-8 relative overflow-hidden transition-all duration-700 ${alertTriggered ? 'bg-red-500/5' : ''}`}>
              
              {/* Animated pulses for state visibility */}
              <div className="relative">
                 <div className="flex gap-10 opacity-30">
                   <Smartphone size={80} className="text-blue-400 scale-90" />
                   <ShieldAlert size={100} className="text-red-400" />
                   <Mail size={80} className="text-orange-400 scale-90" />
                 </div>
                 {alertTriggered && (
                    <motion.div 
                      className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                 )}
              </div>

              <div className="space-y-3 z-10">
                 <h3 className="text-3xl font-display font-black text-white uppercase tracking-tighter">
                   {alertTriggered ? 'SOS DISPATCH ACTIVE' : 'NO ACTIVE ALERTS'}
                 </h3>
                 <p className="max-w-md text-sm text-slate-500 font-medium leading-relaxed">
                   {alertTriggered 
                     ? `The system is currently broadcasting your coordinates and sensor telemetry to authorized contacts. Last pulse at ${new Date(lastAlertTime).toLocaleTimeString()}.`
                     : 'The system has not detected a sustained CRITICAL state long enough to initiate the fail-safe dispatch sequence in this session.'
                   }
                 </p>
              </div>

              {!alertTriggered && (
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-lg">
                    <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01]">
                       <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Cooldown</div>
                       <div className="text-lg font-display font-black text-slate-400">0s</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01]">
                       <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Fail-Safe</div>
                       <div className="text-lg font-display font-black text-slate-400">Auto</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01]">
                       <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Priority</div>
                       <div className="text-lg font-display font-black text-slate-400">High</div>
                    </div>
                 </div>
              )}

              {alertTriggered && (
                 <button className="px-10 py-4 bg-red-500 text-white font-display font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-600 transition-colors shadow-2xl shadow-red-500/20">
                    CANCEL SOS DISPATCH
                 </button>
              )}
           </div>

           <div className="p-6 flex items-center gap-4 text-slate-500 font-mono text-[10px] uppercase font-black">
              <Zap size={14} className="text-amber-400" />
              <span>Cryptographic verification active for all outbound packets</span>
           </div>
        </div>

      </div>
    </div>
  )
}
