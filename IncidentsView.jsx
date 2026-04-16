import React from 'react'
import { ShieldAlert, ChevronRight, Search, FileText, Database, ShieldCheck } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import { motion } from 'framer-motion'

export default function IncidentsView() {
  const { incidents } = useSafetyStore()

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 pb-24">
      
      {/* ── Header ────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Database className="text-primary" />
            <span className="text-xs font-black tracking-[0.3em] text-slate-500 uppercase">Cryptographic Audit Trail</span>
          </div>
          <h1 className="text-5xl font-display font-black tracking-tighter text-white">INTELLIGENCE BUREAU</h1>
          <p className="text-slate-400 mt-4 max-w-2xl font-medium leading-relaxed">
            Historical repository of weighted classification breaches. Every incident contains full sensor telemetry and FSM state transition logs for forensic review.
          </p>
        </div>
      </section>

      {/* ── Triage Summary ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="glass rounded-3xl p-8 border border-white/5">
            <span className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Total Logged</span>
            <div className="text-4xl font-display font-black text-white mt-1">{incidents.length}</div>
         </div>
         <div className="glass rounded-3xl p-8 border border-white/5">
            <span className="text-[10px] font-black tracking-[0.2em] text-red-500/70 uppercase">Escalated</span>
            <div className="text-4xl font-display font-black text-red-400 mt-1">
               {incidents.filter(i => i.threat_level === 'CRITICAL').length}
            </div>
         </div>
         <div className="glass rounded-3xl p-8 border border-white/5 bg-primary/5">
            <span className="text-[10px] font-black tracking-[0.2em] text-primary uppercase">FSM Integrity</span>
            <div className="text-4xl font-display font-black text-white mt-1">100%</div>
         </div>
      </div>

      <div className="glass rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
           <div className="flex items-center gap-2">
              <Search size={14} className="text-slate-500" />
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Historical Query</span>
           </div>
           <div className="flex gap-4">
              <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                 <div className="h-full bg-primary w-2/3" />
              </div>
           </div>
        </div>

        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-[#0a0e17] text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 border-b border-white/5">
            <tr>
              <th className="px-8 py-5">Temporal Stamp</th>
              <th className="px-8 py-5">Severity Node</th>
              <th className="px-8 py-5">Intelligence Summary</th>
              <th className="px-8 py-5">Risk Matrix</th>
              <th className="px-8 py-5 text-right">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {incidents.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-8 py-20 text-center text-slate-600 font-mono text-xs uppercase tracking-widest">
                   <ShieldCheck className="mx-auto mb-4 opacity-10" size={48} />
                   Clear Intelligence Database
                </td>
              </tr>
            ) : null}
            {incidents.map((inc, i) => (
              <tr key={i} className="hover:bg-white/[0.03] transition-colors group cursor-pointer border-l-2 border-transparent hover:border-primary">
                <td className="px-8 py-6 whitespace-nowrap font-mono text-xs text-slate-500">
                  {new Date(inc.timestamp || Date.now()).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="px-8 py-6">
                  <span className={`px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase border ${
                    inc.threat_level === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                  }`}>
                    {inc.threat_level}
                  </span>
                </td>
                <td className="px-8 py-6 font-medium text-slate-200">
                   <div className="flex flex-col gap-1">
                      <span className="text-xs tracking-tight">{inc.events?.join(' • ') || 'THRESHOLD OVERFLOW'}</span>
                      <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">
                         Context: {inc.audio_class || 'General Ambient'}
                      </span>
                   </div>
                </td>
                <td className="px-8 py-6 font-display font-black text-lg text-white">
                   {inc.combined_score?.toFixed(1) || '0.0'}
                </td>
                <td className="px-8 py-6 text-right">
                   <button className="flex items-center gap-2 text-[9px] font-black tracking-widest text-primary ml-auto group-hover:gap-4 transition-all uppercase">
                     Full Intel <ChevronRight size={14} strokeWidth={3} />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
