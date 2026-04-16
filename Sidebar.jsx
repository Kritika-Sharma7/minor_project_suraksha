import React from 'react'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  LineChart, 
  ShieldAlert, 
  TestTube, 
  Smartphone, 
  BellRing, 
  Settings2, 
  GraduationCap 
} from 'lucide-react'
import { useSafetyStore } from './safetyStore'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', icon: LineChart },
  { id: 'incidents', label: 'Incidents Log', icon: ShieldAlert },
  { id: 'simulation', label: 'Simulation Lab', icon: TestTube },
  { id: 'devices', label: 'Devices & Sensors', icon: Smartphone },
  { id: 'alerts', label: 'Alert History', icon: BellRing },
  { id: 'settings', label: 'Settings', icon: Settings2 },
  { id: 'academic', label: 'System Architecture', icon: GraduationCap },
]

export default function Sidebar() {
  const { activeView, setActiveView, threatLevel, getThreatMeta } = useSafetyStore()
  const meta = getThreatMeta()

  return (
    <div className="w-64 h-full bg-[#0a0e17]/80 backdrop-blur-xl border-r border-white/5 flex flex-col pt-6 z-20 relative">
      <div className="px-6 mb-8 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/20 border border-primary/50 relative">
            <ShieldAlert size={16} className="text-primary" />
            {threatLevel === 'CRITICAL' && (
              <span className="absolute inset-0 rounded-lg ping-red bg-primary opacity-40"></span>
            )}
          </div>
          <span className="font-display font-extrabold text-xl text-white tracking-widest">SURAKSHA</span>
        </div>
        <span className="text-[9px] text-slate-500 font-mono tracking-[0.2em] uppercase ml-11">Version 3.0</span>
      </div>

      <div className="px-4 mb-6">
        <div 
          className="rounded-lg px-3 py-2 flex items-center justify-between"
          style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
            <span className="text-[10px] font-bold tracking-widest font-mono" style={{ color: meta.color }}>
              {threatLevel === 'SAFE' ? 'SYSTEM SECURE' : `${threatLevel} ALERT`}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase font-bold text-slate-600 tracking-widest mb-3 ml-2 mt-4">Menu</div>
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_12px_rgba(78,222,163,0.05)]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <item.icon size={16} className={isActive ? 'text-primary' : 'text-slate-500'} />
              {item.label}
              {isActive && (
                <motion.div layoutId="nav-indicator" className="ml-auto w-1 h-4 rounded-full bg-primary shadow-[0_0_8px_#4edea3]" />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
