import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useSafetyStore } from './safetyStore'

const THREAT_COLORS = {
  SAFE: '#22c55e', SUSPICIOUS: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444',
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="glass rounded-xl p-3 text-xs border border-white/10">
      <p className="font-mono text-slate-400 mb-1">{label}</p>
      <p className="font-display font-bold" style={{ color: THREAT_COLORS[d?.threatLevel] || '#fff' }}>
        {d?.threatLevel}
      </p>
      <p className="text-white">Score: <span className="font-bold">{payload[0]?.value}</span></p>
      {payload[1] && <p className="text-slate-300">Avg: <span className="font-bold">{payload[1]?.value}</span></p>}
    </div>
  )
}

export default function RiskChart() {
  const { chartData } = useSafetyStore()

  if (chartData.length === 0) {
    return (
      <div className="glass rounded-2xl p-5 h-48 flex items-center justify-center">
        <p className="text-slate-600 text-sm font-mono">Waiting for live sensor stream...</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-sm tracking-widest text-white">RISK TIMELINE</h2>
          <p className="text-xs text-slate-500">Live stream from WebSocket risk engine</p>
        </div>
        <div className="flex gap-3 text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Score
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Avg
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="time" tick={{ fill: '#475569', fontSize: 9, fontFamily: 'JetBrains Mono' }}
            axisLine={false} tickLine={false} interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 255]} tick={{ fill: '#475569', fontSize: 9, fontFamily: 'JetBrains Mono' }}
            axisLine={false} tickLine={false}
            ticks={[0, 64, 128, 192, 255]}
          />
          {/* Threshold lines */}
          <ReferenceLine y={64}  stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.3} label={{ value: 'SUSP', fill: '#f59e0b', fontSize: 8 }} />
          <ReferenceLine y={128} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.3} label={{ value: 'HIGH', fill: '#f97316', fontSize: 8 }} />
          <ReferenceLine y={192} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.3} label={{ value: 'CRIT', fill: '#ef4444', fontSize: 8 }} />

          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} fill="url(#scoreGrad)" dot={false} />
          <Area type="monotone" dataKey="avg"   stroke="#60a5fa" strokeWidth={1.5} fill="url(#avgGrad)"   dot={false} strokeDasharray="4 2" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
