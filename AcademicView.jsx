import React from 'react'
import { BookOpen, Share2, Clipboard, ShieldCheck, Zap, BrainCircuit, Activity, Cpu } from 'lucide-react'
import { motion } from 'framer-motion'

export default function AcademicView() {
  const sections = [
    {
      title: "Finite State Machine (FSM) Logic",
      icon: Cpu,
      desc: "The core threat engine operates on a Deterministic Finite Automaton (DFA) with 4 primary states: SAFE, SUSPICIOUS, HIGH, and CRITICAL. Transitions are governed by weighted sensor vectors.",
      features: ["Hysteresis for state stability", "Transition confidence penalization", "Temporal persistence logic"]
    },
    {
      title: "Neural-Symbolic Fusion",
      icon: BrainCircuit,
      desc: "Combines raw acoustic feature extraction (RMS, ZCR, FFT) with symbolic safety rules. This hybrid approach ensures both real-time performance and explainability.",
      features: ["Multi-domain weight matrices", "Acoustic entropy analysis", "Kinematic momentum tracking"]
    },
    {
      title: "Temporal Probability Density",
      icon: Activity,
      desc: "Instead of point-in-time analysis, Suraksha v3 uses a moving-average window to calculate threat probability over time, filtering transient noise and False Positives.",
      features: ["Moving average smoothing", "Trend delta calculation", "Confidence score scoring"]
    }
  ]

  return (
    <div className="max-w-[1200px] mx-auto space-y-16 pb-32">
      
      {/* ── Header ────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <BookOpen className="text-primary" />
            <span className="text-xs font-black tracking-[0.3em] text-slate-500 uppercase">Platform Documentation v3.2</span>
          </div>
          <h1 className="text-6xl font-display font-black tracking-tighter text-white">SYSTEM WHITEPAPER</h1>
          <p className="text-slate-400 max-w-2xl font-medium text-lg leading-relaxed">
             An academic deep-dive into the architectural logic and mathematical frameworks powering Suraksha's real-time safety classification.
          </p>
        </div>
      </section>

      {/* ── Visual Diagram Mockup ────────────────── */}
      <div className="glass rounded-[3rem] p-12 border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent relative overflow-hidden">
         <div className="absolute top-0 right-0 p-10 opacity-5">
            <Share2 size={300} strokeWidth={1} />
         </div>
         
         <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
               <h2 className="text-3xl font-display font-black text-white uppercase italic">The Intelligence Pipeline</h2>
               <div className="space-y-4">
                  {[
                    { l: "Input", v: "Multi-Sensor Stream (Location, Audio, Motion)" },
                    { l: "DSP", v: "High-Pass Filter + Feature Extraction (ZCR)" },
                    { l: "Decision", v: "Weighted Summation → FSM Transition" },
                    { l: "Output", v: "Explainable Risk Vector + Alert Dispatch" }
                  ].map((step, i) => (
                    <div key={i} className="flex gap-4 items-start">
                       <span className="text-primary font-mono text-sm leading-none pt-1">0{i+1}</span>
                       <div>
                          <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase mb-1">{step.l}</p>
                          <p className="text-sm font-medium text-white/80">{step.v}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="aspect-video glass bg-white/[0.01] border border-white/5 rounded-[2rem] flex items-center justify-center p-8">
               <div className="grid grid-cols-2 gap-4 w-full h-full opacity-30 pointer-events-none">
                  <div className="border border-white/10 rounded-2xl flex items-center justify-center font-mono text-[8px]">FSM::SAFE</div>
                  <div className="border border-white/10 rounded-2xl flex items-center justify-center font-mono text-[8px]">FSM::SUSPICIOUS</div>
                  <div className="border border-white/10 rounded-2xl flex items-center justify-center font-mono text-[8px]">FSM::HIGH</div>
                  <div className="border border-white/10 rounded-2xl flex items-center justify-center font-mono text-[8px]">FSM::CRITICAL</div>
               </div>
            </div>
         </div>
      </div>

      {/* ── Core Sections ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         {sections.map(s => (
           <div key={s.title} className="glass rounded-[2rem] p-8 border border-white/5 space-y-6 flex flex-col">
              <div className="p-3 rounded-2xl bg-white/[0.03] text-primary w-fit">
                 <s.icon size={24} />
              </div>
              <h3 className="text-lg font-display font-black text-white italic uppercase tracking-tight">{s.title}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed flex-1">{s.desc}</p>
              <ul className="space-y-3 pt-6 border-t border-white/5">
                 {s.features.map(f => (
                   <li key={f} className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <div className="w-1 h-1 rounded-full bg-primary" />
                      {f}
                   </li>
                 ))}
              </ul>
           </div>
         ))}
      </div>

      {/* ── References ────────────────── */}
      <div className="glass rounded-[2rem] p-10 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 bg-white/[0.01]">
         <div className="flex items-center gap-4">
            <Clipboard className="text-slate-500" />
            <div className="text-xs font-medium text-slate-500">
               Current Build: <span className="text-white">v3.2.1-Alpha-Decision-Cluster</span>
            </div>
         </div>
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 group cursor-pointer">
               <Share2 size={14} className="text-primary group-hover:scale-110 transition-transform" />
               <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Share Research</span>
            </div>
            <div className="flex items-center gap-2 group cursor-pointer">
               <ShieldCheck size={14} className="text-primary group-hover:scale-110 transition-transform" />
               <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Export Protocol</span>
            </div>
         </div>
      </div>
    </div>
  )
}
