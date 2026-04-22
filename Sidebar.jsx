import React, { useState } from 'react'
import { Menu, X, Users, Car } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  LineChart,
  ShieldAlert,
  TestTube,
  Smartphone,
  BellRing,
  Settings2,
  GraduationCap,
  Navigation,
} from 'lucide-react'
import { useSafetyStore } from './safetyStore'

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
  { id: 'analytics',  label: 'Analytics',           icon: LineChart       },
  { id: 'incidents',  label: 'Incidents Log',        icon: ShieldAlert     },
  { id: 'journey',    label: 'Journey Mode',         icon: Navigation      },
  { id: 'simulation', label: 'Simulation Lab',       icon: TestTube        },
  { id: 'devices',    label: 'Devices & Sensors',    icon: Smartphone      },
  { id: 'alerts',     label: 'Alert History',        icon: BellRing        },
  { id: 'settings',   label: 'Settings',             icon: Settings2       },
  { id: 'academic',   label: 'System Architecture',  icon: GraduationCap   },
]

const MODE_META = {
  women: { label: 'Women Safety', Icon: Users,  color: '#4edea3', bg: 'rgba(78,222,163,0.08)' },
  cab:   { label: 'Cab Mode',     Icon: Car,    color: '#60a5fa', bg: 'rgba(96,165,250,0.08)'  },
}

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const { activeView, setActiveView, threatLevel, getThreatMeta, applicationMode } = useSafetyStore()
  const meta     = getThreatMeta()
  const modeMeta = MODE_META[applicationMode] || MODE_META.women

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 p-3 glass rounded-2xl lg:hidden text-white border border-white/10"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 w-64 h-full
        bg-[#0a0e17]/80 lg:bg-[#0a0e17]/40 backdrop-blur-2xl lg:backdrop-blur-none
        border-r border-white/5 flex flex-col pt-6 z-40 lg:z-20
        transition-transform duration-500 ease-spring
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Brand */}
        <div className="px-6 mb-6 flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/20 border border-primary/50 relative">
              <ShieldAlert size={16} className="text-primary" />
              {threatLevel === 'CRITICAL' && (
                <span className="absolute inset-0 rounded-lg ping-red bg-primary opacity-40" />
              )}
            </div>
            <span className="font-display font-extrabold text-xl text-white tracking-widest">SURAKSHA</span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono tracking-[0.2em] uppercase ml-11">
            Version 3.0
          </span>
        </div>

        {/* Threat status */}
        <div className="px-4 mb-3">
          <div
            className="rounded-lg px-3 py-2 flex items-center justify-between"
            style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
              />
              <span
                className="text-[10px] font-bold tracking-widest font-mono"
                style={{ color: meta.color }}
              >
                {threatLevel === 'SAFE' ? 'SYSTEM SECURE' : `${threatLevel} ALERT`}
              </span>
            </div>
          </div>
        </div>

        {/* Active Mode badge */}
        <div className="px-4 mb-5">
          <div
            className="rounded-lg px-3 py-2 flex items-center gap-2"
            style={{ background: modeMeta.bg, border: `1px solid ${modeMeta.color}30` }}
          >
            <modeMeta.Icon size={13} style={{ color: modeMeta.color }} />
            <span
              className="text-[10px] font-bold tracking-wider font-mono"
              style={{ color: modeMeta.color }}
            >
              {modeMeta.label.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase font-bold text-slate-600 tracking-widest mb-3 ml-2">
            Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id
            return (
              <button
                key={item.id}
                onClick={() => { setActiveView(item.id); setIsOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_12px_rgba(78,222,163,0.05)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <item.icon size={16} className={isActive ? 'text-primary' : 'text-slate-500'} />
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="ml-auto w-1 h-4 rounded-full bg-primary shadow-[0_0_8px_#4edea3]"
                  />
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </>
  )
}
