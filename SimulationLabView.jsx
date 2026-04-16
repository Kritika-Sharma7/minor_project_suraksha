import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TestTube, Zap, ShieldAlert, ActivitySquare, AlertTriangle, Play, RefreshCw, Layers, Database, Globe } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import toast from 'react-hot-toast'

export default function SimulationLabView() {
  const { setSensorFrame, setApplicationMode, applicationMode } = useSafetyStore()
  
  const [motionAcc, setMotionAcc] = useState(9.8)
  const [audioRms, setAudioRms] = useState(0.02)
  const [zcr, setZcr] = useState(0.05)
  const [freq, setFreq] = useState(440)

  const scenarios = [
    {
      id: 'fall',
      name: 'Dynamic Fall Event',
      icon: ActivitySquare,
      color: 'red',
      desc: 'Simulates a 9G impact followed by absolute zero movement.',
      action: () => {
        setSensorFrame({
          motion: { accelMag: 90.0, gyroMag: 400.0, fallProb: 0.99, shakeScore: 0.8 },
          audio: { rms: 0.01, zcr: 0.02, freq: 0 }
        })
        toast.error('Simulation: Massive sudden impact injected')
      }
    },
    {
      id: 'attack',
      name: 'Violent Struggle',
      icon: ShieldAlert,
      color: 'orange',
      desc: 'High-frequency gyro rotation + scream acoustic signature.',
      action: () => {
        setSensorFrame({
          motion: { accelMag: 45.0, gyroMag: 250.0, shakeScore: 0.95 },
          audio: { rms: 0.45, zcr: 0.35, freq: 2800, screamScore: 0.9 }
        })
        toast.error('Simulation: High-intensity struggle injected')
      }
    },
    {
      id: 'isolation',
      name: 'Isolation Risk',
      icon: Globe,
      color: 'cyan',
      desc: 'Low GPS accuracy + zero speed + night mode enabled.',
      action: () => {
        setSensorFrame({
          location: { lat: 12.9716, lon: 77.5946, accuracy: 250, speed: 0, isolation: 0.95 }
        })
        setApplicationMode('women')
        toast.success('Simulation: Strategic isolation injected')
      }
    }
  ]

  const clearSim = () => {
    setSensorFrame({
      motion: { accelMag: 9.8, gyroMag: 0, shakeScore: 0, fallProb: 0, runningScore: 0 },
      audio: { rms: 0.02, zcr: 0.05, freq: 440, screamScore: 0, keyword: '', keyword_detected: false },
      location: { accuracy: 10, speed: 1.2, isolation: 0.1 }
    })
    setMotionAcc(9.8)
    setAudioRms(0.02)
    setZcr(0.05)
    setFreq(440)
    toast.success('Simulation: Environment normalized')
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-24">
      
      {/* ── Header ────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <TestTube className="text-secondary" />
            <span className="text-xs font-black tracking-[0.3em] text-slate-500 uppercase">Academic Validation Sandbox</span>
          </div>
          <h1 className="text-5xl font-display font-black tracking-tighter text-white">SIMULATION LAB</h1>
        </div>
        <div className="flex gap-4">
           <button onClick={clearSim} className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold text-slate-300 transition-all">
             <RefreshCw size={14} /> RESET ENVIRONMENT
           </button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* ── Main Canvas (Left 3 cols) ────────────────── */}
        <div className="xl:col-span-3 space-y-8">
          
          {/* Quick Scenario Injectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {scenarios.map(s => (
              <motion.button 
                key={s.id}
                whileHover={{ y: -5 }}
                onClick={s.action}
                className="glass group rounded-3xl p-8 text-left border border-white/5 hover:border-primary/20 transition-all flex flex-col h-full bg-gradient-to-br from-white/[0.02] to-transparent"
              >
                <div className={`w-14 h-14 rounded-2xl bg-${s.color}-500/10 flex items-center justify-center mb-6 text-${s.color}-400 group-hover:scale-110 transition-transform`}>
                  <s.icon size={28} />
                </div>
                <h3 className="text-xl font-display font-black text-white mb-2">{s.name}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed flex-1">{s.desc}</p>
                <div className="mt-8 flex items-center gap-2 text-[10px] font-black tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                   <Play size={12} fill="currentColor" /> INJECT SEQUENCE
                </div>
              </motion.button>
            ))}
          </div>

          {/* Manual Control Grid */}
          <div className="glass rounded-3xl p-10 border border-white/5">
            <div className="flex items-center gap-3 mb-10">
               <Layers className="text-primary" />
               <h3 className="text-lg font-display font-black text-white/90 uppercase tracking-tighter">GRANULAR SIGNAL INJECTION</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Motion Lab */}
              <div className="space-y-8">
                <div className="flex items-center gap-2 mb-2">
                  <ActivitySquare size={16} className="text-red-400" />
                  <span className="text-xs font-black tracking-widest text-slate-500 uppercase">Kinetic Forces</span>
                </div>
                
                <div className="space-y-6">
                   <div className="space-y-3">
                      <div className="flex justify-between font-mono text-[10px] text-slate-400">
                        <span>ACCELERATION MAGNITUDE</span>
                        <span className="text-white">{motionAcc.toFixed(2)} G</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" step="0.5" value={motionAcc}
                        onChange={(e) => {
                          const v = Number(e.target.value); setMotionAcc(v);
                          setSensorFrame({ motion: { accelMag: v }})
                        }}
                        className="w-full accent-primary h-1 bg-white/5 rounded-full appearance-none"
                      />
                   </div>
                </div>
              </div>

              {/* Audio Lab */}
              <div className="space-y-8">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-amber-400" />
                  <span className="text-xs font-black tracking-widest text-slate-500 uppercase">Acoustic Signals</span>
                </div>

                <div className="grid grid-cols-1 gap-6">
                   <div className="space-y-3">
                      <div className="flex justify-between font-mono text-[10px] text-slate-400">
                        <span>ZERO CROSSING RATE (ZCR)</span>
                        <span className="text-white">{zcr.toFixed(3)}</span>
                      </div>
                      <input 
                        type="range" min="0" max="0.5" step="0.01" value={zcr}
                        onChange={(e) => {
                          const v = Number(e.target.value); setZcr(v);
                          setSensorFrame({ audio: { zcr: v }})
                        }}
                        className="w-full accent-secondary h-1 bg-white/5 rounded-full appearance-none"
                      />
                   </div>
                   <div className="space-y-3">
                      <div className="flex justify-between font-mono text-[10px] text-slate-400">
                        <span>DOMINANT FREQUENCY</span>
                        <span className="text-white">{freq} Hz</span>
                      </div>
                      <input 
                        type="range" min="40" max="8000" step="10" value={freq}
                        onChange={(e) => {
                          const v = Number(e.target.value); setFreq(v);
                          setSensorFrame({ audio: { freq: v }})
                        }}
                        className="w-full accent-primary h-1 bg-white/5 rounded-full appearance-none"
                      />
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar Stats (Right 1 col) ────────────────── */}
        <div className="space-y-6">
           <div className="glass rounded-3xl p-6 border border-white/5 bg-primary/5">
              <div className="flex items-center gap-2 mb-4">
                 <Database size={16} className="text-primary" />
                 <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Engine Context</h4>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-500 font-medium">Platform Mode</span>
                    <span className="text-xs text-white font-black uppercase text-primary">{applicationMode}</span>
                 </div>
                 <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-500 font-medium">Injection Rate</span>
                    <span className="text-xs text-white font-black uppercase">1.0 Hz</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-xs text-slate-500 font-medium">Tunneling</span>
                    <span className="text-[10px] text-green-400 font-black uppercase font-mono">Active</span>
                 </div>
              </div>
           </div>

           <div className="glass rounded-3xl p-6 border border-white/5">
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4 text-center">SAFETY ADVISORY</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed text-center font-medium">
                Simulation data bypasses the local hardware layer. Values injected here are transmitted directly to the backend FSM for evaluation.
              </p>
           </div>
        </div>

      </div>
    </div>
  )
}
