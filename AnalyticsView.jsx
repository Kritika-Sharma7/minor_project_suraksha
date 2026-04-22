import React, { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell,
} from 'recharts'
import { Activity, BarChart2, TrendingUp, ShieldCheck, Zap, BrainCircuit, Globe, MapPin } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import { motion } from 'framer-motion'

export default function AnalyticsView() {
  const { history, chartData, mapPoints, applicationMode } = useSafetyStore()

  // Risk distribution from history
  const dist = { SAFE: 0, SUSPICIOUS: 0, HIGH: 0, CRITICAL: 0 }
  history.forEach(h => { if (dist[h.threatLevel] !== undefined) dist[h.threatLevel]++ })
  const total = history.length || 1

  const pieData = [
    { name: 'SAFE',       value: dist.SAFE,       color: '#22c55e' },
    { name: 'SUSPICIOUS', value: dist.SUSPICIOUS, color: '#f59e0b' },
    { name: 'HIGH',       value: dist.HIGH,       color: '#f97316' },
    { name: 'CRITICAL',   value: dist.CRITICAL,   color: '#ef4444' },
  ]

  // Build chart series: use live chartData if available, otherwise derive from history
  const seriesData = useMemo(() => {
    if (chartData.length > 0) return chartData
    // Fall back to history (already stored, just reformatted for the chart)
    return history.slice().reverse().map(h => ({
      time:       new Date(h.timestamp).toLocaleTimeString(),
      score:      Math.round(h.combinedScore),
      avg:        Math.round(h.movingAvg ?? h.combinedScore),
      threatLevel: h.threatLevel,
      confidence:  Math.round((h.confidence ?? 0)),
    }))
  }, [chartData, history])

  // Real computed metrics
  const avgRisk = history.length > 0
    ? (history.reduce((a, b) => a + (b.combinedScore ?? 0), 0) / history.length).toFixed(1)
    : '—'

  const nonSafeCount = dist.SUSPICIOUS + dist.HIGH + dist.CRITICAL
  const alertRate = total > 1 ? ((nonSafeCount / total) * 100).toFixed(1) + '%' : '—'

  const sessionMins = history.length > 1
    ? Math.round((history[0].timestamp - history[history.length - 1].timestamp) / 60000)
    : 0
  const sessionUptime = sessionMins > 0 ? `${sessionMins}m` : '< 1m'

  const geoPoints = mapPoints.filter(p => p.lat && p.lon).length
  const geoLabel = geoPoints > 0 ? `${geoPoints} pts` : '—'

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-24">

      {/* ── Header ────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BarChart2 className="text-secondary" />
            <span className="text-xs font-black tracking-[0.3em] text-slate-500 uppercase">Multi-Dimensional Safety Matrix</span>
          </div>
          <h1 className="text-5xl font-display font-black tracking-tighter text-white">SYSTEM ANALYTICS</h1>
          <p className="text-slate-400 mt-4 max-w-2xl font-medium leading-relaxed">
            Temporal probability densities and sensor fusion distribution. This layer provides academic-grade telemetry for safety auditing and engine calibration.
          </p>
        </div>
      </section>

      {/* ── Metric Grid ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'AVERAGE RISK',    value: avgRisk,      icon: Activity,    color: 'primary' },
          { label: 'ALERT RATE',      value: alertRate,    icon: TrendingUp,  color: 'secondary' },
          { label: 'SESSION UPTIME',  value: sessionUptime, icon: Zap,        color: 'blue' },
          { label: 'GPS POINTS',      value: geoLabel,     icon: MapPin,      color: 'cyan' },
        ].map(m => (
          <div key={m.label} className="glass rounded-[2rem] p-8 border border-white/5 relative overflow-hidden group">
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <m.icon size={12} className={`text-${m.color}`} />
              <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">{m.label}</span>
            </div>
            <div className="text-4xl font-display font-black text-white relative z-10">{m.value}</div>
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <m.icon size={100} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* State Distribution (Donut) */}
        <div className="glass rounded-[2.5rem] p-10 border border-white/5 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-10">
            <h3 className="text-sm font-display font-black tracking-tighter text-white uppercase opacity-70 italic">Probability Spread</h3>
            <BrainCircuit size={16} className="text-primary" />
          </div>
          <div className="w-full aspect-square relative flex items-center justify-center">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {pieData.map((d, i) => (
                      <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                        <stop offset="100%" stopColor={d.color} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie data={pieData} cx="50%" cy="50%"
                    innerRadius="75%" outerRadius="100%"
                    paddingAngle={8} dataKey="value" stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#grad-${index})`}
                        style={{ filter: `drop-shadow(0 0 10px ${entry.color}40)` }} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-700 font-mono italic">Buffering stream…</div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-5xl font-display font-black text-white">{history.length}</span>
              <span className="text-[10px] text-slate-500 font-black tracking-[0.2em] uppercase">VECTORS</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mt-10">
            {pieData.map(d => (
              <div key={d.name} className="flex flex-col p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{d.name}</span>
                </div>
                <span className="text-lg font-display font-bold text-white/90">
                  {((d.value / total) * 100).toFixed(0)}%
                </span>
                <span className="text-[10px] text-slate-600 font-mono">{d.value} frames</span>
              </div>
            ))}
          </div>
        </div>

        {/* Temporal Density (Area Chart) */}
        <div className="xl:col-span-2 glass rounded-[2.5rem] p-10 border border-white/5 flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-sm font-display font-black tracking-tighter text-white uppercase opacity-70 italic">Temporal Risk Overlays</h3>
              <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-widest">
                {seriesData.length > 0 ? `${seriesData.length} frames · ${applicationMode === 'cab' ? 'CAB MODE' : 'WOMEN MODE'}` : 'Multi-Series session analysis'}
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Risk Score</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#6366f1' }} />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Moving Avg</span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[400px]">
            {seriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={seriesData} margin={{ left: -30, right: 0, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4edea3" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4edea3" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="avgG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={[0, 100]} />
                  <RechartsTooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(10,14,23,0.9)',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(10px)',
                      fontSize: '11px',
                    }}
                    formatter={(val, name) => [Math.round(val), name === 'score' ? 'Risk Score' : 'Moving Avg']}
                  />
                  <Area type="monotone" dataKey="score" stroke="#4edea3" strokeWidth={2.5}
                    fillOpacity={1} fill="url(#scoreG)" dot={false} />
                  <Area type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={1.5}
                    strokeDasharray="4 4" fill="url(#avgG)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <span className="text-[10px] font-mono text-slate-700 font-black uppercase tracking-[0.5em] animate-pulse">
                  Syncing Session Intelligence Matrix…
                </span>
                <span className="text-[10px] text-slate-700 font-mono">Connect to backend to stream live data</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
