import React, { useState } from 'react'
import { MapPin, Clock, Activity, Mic, Zap, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import { useSafetyStore } from '../store/safetyStore'
import { analyzeRisk } from '../utils/api'
import toast from 'react-hot-toast'

const INPUTS = [
  { key: 'locationRisk', apiKey: 'location_risk', label: 'Location Risk',  Icon: MapPin,   desc: 'Danger level of current area' },
  { key: 'timeRisk',     apiKey: 'time_risk',     label: 'Time Risk',      Icon: Clock,    desc: 'Risk based on time of day' },
  { key: 'motionRisk',   apiKey: 'motion_risk',   label: 'Motion Risk',    Icon: Activity, desc: 'Abnormal movement detection' },
  { key: 'audioRisk',    apiKey: 'audio_risk',    label: 'Audio Risk',     Icon: Mic,      desc: 'Environmental sound analysis' },
]

function scoreColor(val) {
  if (val >= 192) return '#ef4444'
  if (val >= 128) return '#f97316'
  if (val >= 64)  return '#f59e0b'
  return '#22c55e'
}

function RiskSlider({ config, value, onChange }) {
  const { label, Icon, desc } = config
  const color = scoreColor(value)
  const pct   = (value / 255) * 100

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${color}18`, border: `1px solid ${color}40` }}
          >
            <Icon size={14} style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-[10px] text-slate-500">{desc}</p>
          </div>
        </div>
        <div className="text-right">
          <motion.span
            className="font-display font-bold text-lg leading-none"
            animate={{ color }}
            transition={{ duration: 0.3 }}
          >
            {value}
          </motion.span>
          <span className="text-slate-600 text-xs">/255</span>
        </div>
      </div>

      {/* Custom slider */}
      <div className="relative">
        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${pct}%`, background: color }}
            transition={{ duration: 0.2 }}
            style={{ boxShadow: `0 0 8px ${color}80` }}
          />
        </div>
        <input
          type="range" min={0} max={255} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
        />
      </div>

      {/* Quick presets */}
      <div className="flex gap-1 mt-2">
        {[0, 64, 128, 192, 255].map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="flex-1 text-[9px] font-mono py-0.5 rounded transition-colors"
            style={{
              background: value === v ? `${scoreColor(v)}25` : 'rgba(255,255,255,0.04)',
              color:      value === v ? scoreColor(v) : '#64748b',
              border:     `1px solid ${value === v ? scoreColor(v) + '40' : 'transparent'}`,
            }}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function InputDashboard() {
  const store = useSafetyStore()
  const { isAnalyzing, audioClass } = store
  const [lastResult, setLastResult] = useState(null)

  const handleAnalyze = async () => {
    store.setIsAnalyzing(true)
    try {
      const payload = {
        location_risk: store.locationRisk,
        time_risk:     store.timeRisk,
        motion_risk:   store.motionRisk,
        audio_risk:    store.audioRisk,
        audio_class:   store.audioClass,
      }
      const result = await analyzeRisk(payload)
      store.setAnalysisResult(result)
      setLastResult(result)

      if (result.alert_triggered) {
        toast.error('🚨 CRITICAL ALERT TRIGGERED — Emergency contacts notified!', { duration: 6000 })
      } else {
        toast.success(`Analysis complete: ${result.threat_level}`, { duration: 2000 })
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      store.setIsAnalyzing(false)
    }
  }

  const handleReset = () => {
    INPUTS.forEach(({ key }) => store.setInput(key, 0))
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-sm tracking-widest text-white">INPUT DASHBOARD</h2>
          <p className="text-xs text-slate-500 mt-0.5">Adjust risk parameters and analyze</p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors font-mono"
        >
          <RotateCcw size={12} />
          RESET
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {INPUTS.map(({ key, ...rest }) => (
          <RiskSlider
            key={key}
            config={{ ...rest }}
            value={store[key]}
            onChange={(v) => store.setInput(key, v)}
          />
        ))}
      </div>

      {/* Audio class badge */}
      {audioClass !== 'N/A' && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
          <Mic size={13} className="text-slate-400" />
          <span className="text-xs text-slate-400 font-mono">
            Audio class from ML: <span className="text-white font-medium">{audioClass.toUpperCase()}</span>
          </span>
        </div>
      )}

      {/* Analyze button */}
      <motion.button
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        whileTap={{ scale: 0.97 }}
        className="w-full py-3 rounded-xl font-display font-bold tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300"
        style={{
          background: isAnalyzing
            ? 'rgba(255,255,255,0.05)'
            : 'linear-gradient(135deg, #ef444420, #f9731620)',
          border:  '1px solid rgba(239,68,68,0.4)',
          color:   isAnalyzing ? '#64748b' : '#ef4444',
          boxShadow: isAnalyzing ? 'none' : '0 0 20px rgba(239,68,68,0.15)',
        }}
      >
        <Zap size={16} />
        {isAnalyzing ? 'ANALYZING…' : 'ANALYZE THREAT'}
      </motion.button>
    </div>
  )
}
