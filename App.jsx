import React from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import Header from './components/Header'
import InputDashboard from './components/InputDashboard'
import ThreatIndicator from './components/ThreatIndicator'
import RiskChart from './components/RiskChart'
import AlertPanel from './components/AlertPanel'
import HistoryLog from './components/HistoryLog'
import AudioDetector from './components/AudioDetector'

export default function App() {
  useWebSocket()

  return (
    <div className="min-h-screen bg-base noise relative">
      <div className="scan-overlay" />

      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <Header />

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">

          {/* Left column */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <ThreatIndicator />
            <RiskChart />
            <InputDashboard />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            <AlertPanel />
            <AudioDetector />
            <HistoryLog />
          </div>

        </div>
      </div>
    </div>
  )
}
