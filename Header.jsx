import React from 'react'
import { Shield, Wifi, WifiOff } from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import { resetEngine } from './apiClient'
import toast from 'react-hot-toast'

export default function Header() {
  const { wsConnected, threatLevel, getThreatMeta } = useSafetyStore()
  const meta = getThreatMeta()

  const handleReset = async () => {
    try {
      await resetEngine()
      window.location.reload()
    } catch {
      toast.error('Reset failed')
    }
  }

  const startSensors = async () => {
    console.log("Button clicked");

    try {
      // 🎤 MICROPHONE
      await navigator.mediaDevices.getUserMedia({ audio: true });
      alert("Mic permission granted");

      // 📍 LOCATION
      navigator.geolocation.getCurrentPosition(
        () => alert("Location granted"),
        () => alert("Location denied")
      );

      // 📱 MOTION (iPhone)
      if (typeof DeviceMotionEvent !== "undefined" &&
          typeof DeviceMotionEvent.requestPermission === "function") {

        const res = await DeviceMotionEvent.requestPermission();
        alert("Motion: " + res);
      }

    } catch (err) {
      console.error(err);
      if (!navigator.mediaDevices) {
        alert("🚨 iPhone blocked you! Apple Safari completely disables Microphone and Motion APIs if you don't use 'https://'.");
      } else {
        alert("Error details: " + err.message);
      }
    }
  };

  return (
    <header className="flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center relative"
          style={{ background: `${meta.color}20`, border: `1.5px solid ${meta.color}50` }}
        >
          <Shield size={20} style={{ color: meta.color }} />
          {threatLevel === 'CRITICAL' && (
            <span
              className="absolute inset-0 rounded-xl ping-red"
              style={{ background: meta.color, opacity: 0.3 }}
            />
          )}
        </div>
        <div>
          <h1 className="font-display font-bold text-lg text-white tracking-wider leading-none">
            SAFEGUARD
          </h1>
          <p className="text-xs text-slate-500 font-mono">Threat Detection System v2.0</p>
        </div>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-3">
        {/* WS status */}
        <div className="flex items-center gap-1.5 glass rounded-lg px-3 py-1.5">
          {wsConnected
            ? <Wifi size={14} className="text-safe" />
            : <WifiOff size={14} className="text-slate-500" />}
          <span className="text-xs font-mono" style={{ color: wsConnected ? '#22c55e' : '#64748b' }}>
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {/* Current state badge */}
        <div
          className="rounded-lg px-3 py-1.5 font-display text-xs font-bold tracking-widest"
          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}
        >
          {threatLevel}
        </div>

        {/* Start Sensors */}
        <button
          onClick={startSensors}
          className="glass rounded-lg px-3 py-1.5 text-xs text-blue-400 hover:text-white transition-colors font-mono font-bold"
        >
          START SENSORS
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="glass rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors font-mono"
        >
          RESET FSM
        </button>
      </div>
    </header>
  )
}
