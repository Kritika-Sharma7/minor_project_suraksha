import React, { useState } from 'react'
import { useWebSocket } from './useWebSocket'
import LandingPage from './LandingPage'
import Sidebar from './Sidebar'
import Header from './Header'
import { useSafetyStore } from './safetyStore'

// View Components
import DashboardView from './DashboardView'
import AnalyticsView from './AnalyticsView'
import IncidentsView from './IncidentsView'
import SimulationLabView from './SimulationLabView'
import DevicesView from './DevicesView'
import AlertsView from './AlertsView'
import SettingsView from './SettingsView'
import AcademicView from './AcademicView'

export default function App() {
  const [showApp, setShowApp] = useState(false)
  const { activeView } = useSafetyStore()
  useWebSocket()

  if (!showApp) {
    return <LandingPage onStart={() => setShowApp(true)} />
  }

  const renderView = () => {
    switch(activeView) {
      case 'dashboard': return <DashboardView />
      case 'analytics': return <AnalyticsView />
      case 'incidents': return <IncidentsView />
      case 'simulation': return <SimulationLabView />
      case 'devices': return <DevicesView />
      case 'alerts': return <AlertsView />
      case 'settings': return <SettingsView />
      case 'academic': return <AcademicView />
      default: return <DashboardView />
    }
  }

  return (
    <div className="flex h-screen w-full bg-base noise relative dark overflow-hidden text-slate-100">
      <div className="scan-overlay opacity-20 pointer-events-none" />
      
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10 transition-all">
        <div className="px-8 py-4 border-b border-white/5 bg-[#0a0e17]/50 backdrop-blur-md">
           <Header />
        </div>
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-[1600px] mx-auto w-full">
            {renderView()}
          </div>
        </div>
      </div>
    </div>
  )
}
