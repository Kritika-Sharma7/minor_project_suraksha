import React from 'react'
import { Smartphone, Mic, Activity, MapPin, Cpu, Signal, ShieldCheck, Zap, Radio } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import { motion } from 'framer-motion'

export default function DevicesView() {
  const { sensorsEnabled, sensorFrame, speechActive, lastTranscript } = useSafetyStore()

  const sensors = [
    {
      id: 'mic',
      name: 'ACOUSTIC SENSOR',
      icon: Mic,
      color: 'blue',
      enabled: sensorsEnabled.microphone,
      desc: 'Broadband audio sampling using Web Audio API (8× gain).',
      metrics: [
         { label: 'RMS', value: sensorFrame.audio.rms.toFixed(4) },
         { label: 'ZCR', value: sensorFrame.audio.zcr.toFixed(2) }
      ],
      constraints: 'Requires User-Gesture (iOS) • High Latency (Safari)'
    },
    {
      id: 'motion',
      name: 'DYNAMIC KINEMATICS',
      icon: Activity,
      color: 'orange',
      enabled: sensorsEnabled.motion,
      desc: '6-Axis IMU data from DeviceMotionEvent.',
      metrics: [
         { label: 'ACCEL', value: sensorFrame.motion.accelMag.toFixed(2) + 'g' },
         { label: 'PROB', value: sensorFrame.motion.fallProb.toFixed(2) }
      ],
      constraints: 'Secure Context (HTTPS) Required • 20Hz Sampling'
    },
    {
      id: 'location',
      name: 'GEODESIC ENGINE',
      icon: MapPin,
      color: 'green',
      enabled: sensorsEnabled.location,
      desc: 'Continuous GPS/GNSS polling via watchPosition.',
      metrics: [
         { label: 'ACCURACY', value: '±' + sensorFrame.location.accuracy.toFixed(1) + 'm' },
         { label: 'SPEED', value: sensorFrame.location.speed.toFixed(1) + 'm/s' }
      ],
      constraints: 'Battery Intensive • Requires Foreground State'
    }
  ]

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-24">
      
      {/* ── Header ────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="text-primary" />
            <span className="text-xs font-black tracking-[0.3em] text-slate-500 uppercase">Hardware Interoperability Layer</span>
          </div>
          <h1 className="text-5xl font-display font-black tracking-tighter text-white">DEVICE DIAGNOSTICS</h1>
          <p className="text-slate-400 mt-4 max-w-2xl font-medium leading-relaxed">
            Real-time health status of hardware peripherals. This system abstracts browser-level APIs into high-fidelity signal vectors for the FSM engine.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {sensors.map(s => (
          <div key={s.id} className="glass rounded-[2rem] p-8 border border-white/5 relative overflow-hidden group">
            {/* Status indicator */}
            <div className="flex justify-between items-start mb-8">
              <div className={`p-4 rounded-3xl bg-${s.color}-500/10 text-${s.color}-400 group-hover:scale-110 transition-transform`}>
                 <s.icon size={24} />
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black tracking-widest ${
                s.enabled ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${s.enabled ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                {s.enabled ? 'ONLINE' : 'OFFLINE'}
              </div>
            </div>

            <h3 className="text-lg font-display font-black text-white mb-2 uppercase tracking-tight">{s.name}</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 h-10">{s.desc}</p>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-4">
               {s.metrics.map(m => (
                 <div key={m.label} className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                    <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{m.label}</div>
                    <div className="text-xl font-display font-black text-white">{m.value}</div>
                 </div>
               ))}
            </div>

            {/* SpeechRecognition live status — only for mic card */}
            {s.id === 'mic' && (
              <div className="mb-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Radio size={11} className={speechActive ? 'text-green-400 animate-pulse' : 'text-slate-600'} />
                  <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">
                    Keyword Engine
                  </span>
                  <span className={`ml-auto text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full ${
                    speechActive
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-white/5 text-slate-600 border border-white/5'
                  }`}>
                    {speechActive ? 'LISTENING' : 'IDLE'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {sensorFrame.audio.keyword_detected ? (
                    <span className="text-[11px] font-mono text-red-400 font-bold">
                      ⚠ &quot;{sensorFrame.audio.keyword}&quot; detected
                    </span>
                  ) : lastTranscript ? (
                    <span className="text-[11px] font-mono text-slate-400 truncate">
                      Heard: &quot;{lastTranscript}&quot;
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-600 italic">
                      Say &quot;help&quot;, &quot;bachao&quot; or &quot;police&quot;…
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 pt-6 border-t border-white/5 font-mono">
               <Zap size={12} className="text-amber-400 mt-0.5" />
               <span className="text-[10px] text-slate-600 leading-tight uppercase font-black uppercase">{s.constraints}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="glass rounded-[2.5rem] p-10 border border-white/5 flex flex-col md:flex-row items-center gap-10">
         <div className="flex-1">
            <div className="flex items-center gap-2 mb-4">
               <ShieldCheck size={18} className="text-primary" />
               <h3 className="text-sm font-display font-black text-white uppercase tracking-widest">SIGNAL AUTHENTICITY</h3>
            </div>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              All sensor streams are normalized to a 0–255 integer space to ensure compatibility with our Verilog-defined FSM logic. Hardware jitter is filtered via temporal averaging.
            </p>
         </div>
         <div className="w-full md:w-64 h-32 glass bg-white/[0.02] border border-white/10 rounded-3xl flex items-center justify-center">
            <span className="text-[10px] font-mono text-slate-600 font-black uppercase tracking-widest">Telemetry Tunnel Active</span>
         </div>
      </div>
    </div>
  )
}
