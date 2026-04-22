import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  TestTube, Zap, ShieldAlert, ActivitySquare, Play, RefreshCw,
  Layers, Database, Globe, TrendingUp, TrendingDown, Minus, Activity,
  Navigation, ParkingCircle, Moon, Mic, MapPin,
} from 'lucide-react'
import { useSafetyStore } from './safetyStore'
import toast from 'react-hot-toast'

// ── Derived motion fields from a single accelMag value ──────────────────────
const motionFromAcc = (v) => ({
  accelMag:     v,
  shakeScore:   Math.max(0, Math.min(1, (v - 9.8) / 20)),
  fallProb:     Math.max(0, Math.min(1, Math.abs(v - 9.8) / 12)),
  runningScore: Math.max(0, Math.min(1, v / 18)),
  gyroMag:      v > 20 ? (v - 20) * 4 : 0,
})

const screamFrom = (r, z, f) => (z > 0.15 && f > 2000 ? Math.min(1, r * 2.2) : 0)

const THREAT_COLORS = { SAFE: '#22c55e', SUSPICIOUS: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444' }

function Badge({ color, label }) {
  const map = {
    red:    'text-red-400 bg-red-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    green:  'text-green-400 bg-green-500/10',
    blue:   'text-blue-400 bg-blue-500/10',
    slate:  'text-slate-400 bg-slate-500/10',
  }
  return (
    <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full ${map[color] ?? map.slate}`}>
      {label}
    </span>
  )
}

export default function SimulationLabView() {
  const {
    setSensorFrame, setApplicationMode, applicationMode,
    setSimulationActive, setGpsFeatures,
    threatLevel, combinedScore, recommendation, reasons, movingAvg, trend, confidence,
  } = useSafetyStore()

  // Women-mode granular state
  const [motionAcc, setMotionAcc] = useState(9.8)
  const [audioRms,  setAudioRms]  = useState(0.02)
  const [zcr,       setZcr]       = useState(0.05)
  const [freq,      setFreq]      = useState(440)

  // Cab-mode granular state
  const [deviationDist,   setDeviationDist]   = useState(0)    // metres off route
  const [cabSpeed,        setCabSpeed]         = useState(8)    // m/s
  const [stationaryTime,  setStationaryTime]   = useState(0)    // seconds stopped
  const [cabAudioRms,     setCabAudioRms]      = useState(0.02)

  const [activeScenario, setActiveScenario] = useState(null)
  const [countdown,      setCountdown]      = useState(0)
  const timerRef = useRef(null)

  const isCab = applicationMode === 'cab'

  // Activate simulation for the lifetime of this view so sendFrame() won't
  // overwrite injected audio values with live-mic readings.
  useEffect(() => {
    setSimulationActive(true)
    setSensorFrame({
      motion:   { accelMag: 9.8, gyroMag: 0, shakeScore: 0, fallProb: 0, runningScore: 0 },
      audio:    { rms: 0.02, zcr: 0.05, freq: 440, screamScore: 0, keyword: '', keyword_detected: false },
      location: { accuracy: 10, speed: 1.2, isolation: 0.1 },
    })
    setGpsFeatures({ stop_score: 0, deviation_score: 0, confirmed_stop: false, confirmed_deviation: false, stationary_time: 0, speed: 8, distance_from_route: 0 })
    return () => {
      setSimulationActive(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startCountdown = (id, sec = 10) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setActiveScenario(id)
    setCountdown(sec)
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current); setActiveScenario(null); return 0 }
        return c - 1
      })
    }, 1000)
  }

  // ── Women Safety scenarios ───────────────────────────────────────────────
  const womenScenarios = [
    {
      id: 'fall',
      name: 'Dynamic Fall Event',
      icon: ActivitySquare,
      colorClass: 'red',
      desc: 'Simulates a 9G impact followed by absolute zero movement.',
      action: () => {
        setSensorFrame({
          motion: { accelMag: 90.0, gyroMag: 2.0, shakeScore: 0.95, fallProb: 0.99, runningScore: 0 },
          audio:  { rms: 0.01, zcr: 0.02, freq: 0, screamScore: 0, keyword: '', keyword_detected: false },
        })
        setTimeout(() => setSensorFrame({
          motion: { accelMag: 1.2, gyroMag: 0, shakeScore: 0, fallProb: 0, runningScore: 0 },
          audio:  { rms: 0.01, zcr: 0.01, freq: 0, screamScore: 0, keyword: '', keyword_detected: false },
        }), 2000)
        startCountdown('fall', 10)
        toast.error('Simulation: Impact → stillness — fall detection active')
      },
    },
    {
      id: 'attack',
      name: 'Violent Struggle',
      icon: ShieldAlert,
      colorClass: 'orange',
      desc: 'High-frequency gyro rotation + scream acoustic signature.',
      action: () => {
        setSensorFrame({
          motion: { accelMag: 45.0, gyroMag: 250.0, shakeScore: 0.95, fallProb: 0.2, runningScore: 0.3 },
          audio:  { rms: 0.45, zcr: 0.35, freq: 2800, screamScore: 0.9, keyword: 'help', keyword_detected: true },
        })
        startCountdown('attack', 10)
        toast.error('Simulation: Struggle + scream injected — watch Risk Index climb')
      },
    },
    {
      id: 'isolation',
      name: 'Isolation Risk',
      icon: Globe,
      colorClass: 'cyan',
      desc: 'Low GPS accuracy + zero speed + prolonged stationary state.',
      action: () => {
        setSensorFrame({
          location: { lat: 12.9716, lon: 77.5946, accuracy: 250, speed: 0, isolation: 0.95 },
          motion:   { accelMag: 9.8, gyroMag: 0, shakeScore: 0, fallProb: 0, runningScore: 0 },
          audio:    { rms: 0.01, zcr: 0.02, freq: 200, screamScore: 0, keyword: '', keyword_detected: false },
        })
        setGpsFeatures({ stop_score: 0.9, deviation_score: 0.8, confirmed_stop: true, confirmed_deviation: false, stationary_time: 240, speed: 0, distance_from_route: 350 })
        startCountdown('isolation', 10)
        toast.success('Simulation: GPS isolation + 4-min stationary injected')
      },
    },
  ]

  // ── Cab Safety scenarios ─────────────────────────────────────────────────
  const cabScenarios = [
    {
      id: 'deviation',
      name: 'Route Deviation',
      icon: Navigation,
      colorClass: 'orange',
      desc: 'Confirmed off-route by 350m across 3+ consecutive frames.',
      action: () => {
        setGpsFeatures({
          deviation_score: 0.92, confirmed_deviation: true,
          distance_from_route: 350,
          stop_score: 0, confirmed_stop: false,
          stationary_time: 0, speed: 7.5,
        })
        setSensorFrame({
          location: { lat: 22.7196, lon: 75.8577, accuracy: 12, speed: 7.5, isolation: 0.2 },
          audio:    { rms: 0.03, zcr: 0.05, freq: 400, screamScore: 0, keyword: '', keyword_detected: false },
        })
        startCountdown('deviation', 12)
        toast.error('Simulation: Route deviation confirmed — GPS primary signal active')
      },
    },
    {
      id: 'suspstop',
      name: 'Suspicious Stop',
      icon: ParkingCircle,
      colorClass: 'red',
      desc: 'Stopped off-route for 3 minutes — DANGER compound trigger.',
      action: () => {
        setGpsFeatures({
          stop_score: 0.95, confirmed_stop: true,
          deviation_score: 0.75, confirmed_deviation: true,
          stationary_time: 185, speed: 0,
          distance_from_route: 280,
        })
        setSensorFrame({
          location: { lat: 22.7196, lon: 75.8577, accuracy: 15, speed: 0, isolation: 0.6 },
          motion:   { accelMag: 9.8, gyroMag: 0, shakeScore: 0, fallProb: 0, runningScore: 0 },
          audio:    { rms: 0.04, zcr: 0.06, freq: 350, screamScore: 0, keyword: '', keyword_detected: false },
        })
        startCountdown('suspstop', 12)
        toast.error('Simulation: Stopped off-route 3+ min — DANGER compound active')
      },
    },
    {
      id: 'nightisolation',
      name: 'Night Isolation',
      icon: Moon,
      colorClass: 'cyan',
      desc: 'Night-time context + stationary + slight route drift.',
      action: () => {
        setGpsFeatures({
          stop_score: 0.6, confirmed_stop: false,
          deviation_score: 0.45, confirmed_deviation: false,
          stationary_time: 90, speed: 0.3,
          distance_from_route: 130,
        })
        setSensorFrame({
          location: { lat: 22.7196, lon: 75.8577, accuracy: 30, speed: 0.3, isolation: 0.5 },
          audio:    { rms: 0.02, zcr: 0.04, freq: 300, screamScore: 0, keyword: '', keyword_detected: false },
        })
        startCountdown('nightisolation', 12)
        toast('Simulation: Night isolation + slow drift injected', { icon: '🌙' })
      },
    },
  ]

  const scenarios = isCab ? cabScenarios : womenScenarios

  // ── Reset ────────────────────────────────────────────────────────────────
  const clearSim = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setActiveScenario(null)
    setCountdown(0)
    setSensorFrame({
      motion:   { accelMag: 9.8, gyroMag: 0, shakeScore: 0, fallProb: 0, runningScore: 0 },
      audio:    { rms: 0.02, zcr: 0.05, freq: 440, screamScore: 0, keyword: '', keyword_detected: false },
      location: { accuracy: 10, speed: isCab ? 8 : 1.2, isolation: 0.1 },
    })
    setGpsFeatures({ stop_score: 0, deviation_score: 0, confirmed_stop: false, confirmed_deviation: false, stationary_time: 0, speed: isCab ? 8 : 1.2, distance_from_route: 0 })
    setMotionAcc(9.8); setAudioRms(0.02); setZcr(0.05); setFreq(440)
    setDeviationDist(0); setCabSpeed(8); setStationaryTime(0); setCabAudioRms(0.02)
    toast.success('Simulation: Environment normalized')
  }

  const threatColor = THREAT_COLORS[threatLevel] ?? '#22c55e'

  const TrendIcon = () => {
    if (trend === 'ESCALATING') return <TrendingUp size={13} className="text-red-400" />
    if (trend === 'IMPROVING')  return <TrendingDown size={13} className="text-green-400" />
    return <Minus size={13} className="text-slate-400" />
  }

  // ── Signal badges for Women mode ─────────────────────────────────────────
  const MotionBadges = () => (
    <div className="flex gap-2 flex-wrap mt-1 min-h-[20px]">
      {motionAcc > 50  && <Badge color="red"    label="FALL SIGNATURE" />}
      {motionAcc > 25 && motionAcc <= 50 && <Badge color="orange" label="HIGH IMPACT" />}
      {motionAcc >= 8 && motionAcc <= 12 && <Badge color="green"  label="NORMAL WALK" />}
      {motionAcc < 5   && <Badge color="slate"  label="STATIONARY" />}
    </div>
  )

  const AudioBadges = () => (
    <div className="flex gap-2 flex-wrap mt-1 min-h-[20px]">
      {zcr > 0.15 && freq > 2000 && audioRms > 0.1 && <Badge color="red"    label="SCREAM SIGNATURE" />}
      {audioRms > 0.25 && !(zcr > 0.15 && freq > 2000) && <Badge color="orange" label="HIGH ENERGY" />}
      {audioRms <= 0.05 && <Badge color="green" label="AMBIENT / QUIET" />}
    </div>
  )

  // ── Signal badges for Cab mode ────────────────────────────────────────────
  const DeviationBadges = () => (
    <div className="flex gap-2 flex-wrap mt-1 min-h-[20px]">
      {deviationDist > 200 && <Badge color="red"    label="CONFIRMED DEVIATION" />}
      {deviationDist > 80 && deviationDist <= 200 && <Badge color="orange" label="ROUTE DRIFT" />}
      {deviationDist <= 20 && <Badge color="green"  label="ON ROUTE" />}
    </div>
  )

  const StopBadges = () => (
    <div className="flex gap-2 flex-wrap mt-1 min-h-[20px]">
      {stationaryTime > 120 && deviationDist > 80 && <Badge color="red"    label="DANGER STOP" />}
      {stationaryTime > 60  && deviationDist <= 80 && <Badge color="orange" label="LONG STOP" />}
      {stationaryTime <= 15 && <Badge color="green"  label="MOVING" />}
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-24">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <TestTube className="text-secondary" />
            <span className="text-xs font-black tracking-[0.3em] text-slate-500 uppercase">Academic Validation Sandbox</span>
          </div>
          <h1 className="text-5xl font-display font-black tracking-tighter text-white">SIMULATION LAB</h1>
          <p className="text-slate-500 text-xs font-mono mt-2">
            Mode: <span className={isCab ? 'text-blue-400' : 'text-primary'}>{isCab ? 'CAB SAFETY — GPS primary' : 'WOMEN SAFETY — Audio primary'}</span>
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-black text-green-400 tracking-widest">SIM ACTIVE</span>
          </div>
          <button
            onClick={clearSim}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold text-slate-300 transition-all"
          >
            <RefreshCw size={14} /> RESET ENVIRONMENT
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

        {/* ── Main Canvas ───────────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-8">

          {/* Quick Scenario Injectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {scenarios.map(s => (
              <motion.button
                key={s.id}
                whileHover={{ y: -4 }}
                onClick={s.action}
                className={`glass group rounded-3xl p-8 text-left border transition-all flex flex-col h-full bg-gradient-to-br from-white/[0.02] to-transparent ${
                  activeScenario === s.id
                    ? 'border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.08)]'
                    : 'border-white/5 hover:border-primary/20'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl bg-${s.colorClass}-500/10 flex items-center justify-center mb-6 text-${s.colorClass}-400 group-hover:scale-110 transition-transform`}>
                  <s.icon size={28} />
                </div>
                <h3 className="text-xl font-display font-black text-white mb-2">{s.name}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed flex-1">{s.desc}</p>
                {activeScenario === s.id ? (
                  <div className="mt-8 flex items-center justify-between">
                    <span className="text-[10px] font-black text-red-400 tracking-widest animate-pulse">INJECTING...</span>
                    <span className="text-xs font-black text-slate-400 font-mono">{countdown}s</span>
                  </div>
                ) : (
                  <div className="mt-8 flex items-center gap-2 text-[10px] font-black tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={12} fill="currentColor" /> INJECT SEQUENCE
                  </div>
                )}
              </motion.button>
            ))}
          </div>

          {/* Granular Signal Injection — mode-aware */}
          <div className="glass rounded-3xl p-10 border border-white/5">
            <div className="flex items-center gap-3 mb-10">
              <Layers className="text-primary" />
              <h3 className="text-lg font-display font-black text-white/90 uppercase tracking-tighter">GRANULAR SIGNAL INJECTION</h3>
            </div>

            {isCab ? (
              /* ── CAB MODE controls ──────────────────────────────────── */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

                {/* GPS / Route */}
                <div className="space-y-8">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-blue-400" />
                    <span className="text-xs font-black tracking-widest text-slate-500 uppercase">GPS / Route Signals</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between font-mono text-[10px] text-slate-400">
                      <span>DISTANCE FROM ROUTE</span>
                      <span className="text-white">{deviationDist} m</span>
                    </div>
                    <input type="range" min="0" max="500" step="5" value={deviationDist}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setDeviationDist(v)
                        const devScore = Math.min(1, v / 300)
                        const confirmed = v > 200
                        setGpsFeatures({ deviation_score: devScore, confirmed_deviation: confirmed, distance_from_route: v })
                      }}
                      className="w-full accent-blue-400 h-1 bg-white/5 rounded-full appearance-none"
                    />
                    <DeviationBadges />
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5">
                      {[{ label: 'ON ROUTE', val: 0 }, { label: 'DRIFT', val: 130 }, { label: 'DEVIATE', val: 350 }].map(p => (
                        <button key={p.label} onClick={() => {
                          setDeviationDist(p.val)
                          const devScore = Math.min(1, p.val / 300)
                          setGpsFeatures({ deviation_score: devScore, confirmed_deviation: p.val > 200, distance_from_route: p.val })
                        }} className="text-[9px] font-black tracking-widest text-slate-500 hover:text-primary bg-white/[0.03] hover:bg-primary/10 border border-white/5 rounded-xl py-1.5 transition-all">
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between font-mono text-[10px] text-slate-400">
                      <span>VEHICLE SPEED</span>
                      <span className="text-white">{cabSpeed.toFixed(1)} m/s</span>
                    </div>
                    <input type="range" min="0" max="25" step="0.5" value={cabSpeed}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setCabSpeed(v)
                        setSensorFrame({ location: { speed: v } })
                        setGpsFeatures({ speed: v })
                      }}
                      className="w-full accent-blue-400 h-1 bg-white/5 rounded-full appearance-none"
                    />
                    <div className="flex gap-2 flex-wrap mt-1 min-h-[20px]">
                      {cabSpeed < 0.5 && <Badge color="orange" label="STOPPED" />}
                      {cabSpeed >= 0.5 && cabSpeed < 5 && <Badge color="slate" label="SLOW" />}
                      {cabSpeed >= 5   && <Badge color="green"  label="MOVING" />}
                    </div>
                  </div>
                </div>

                {/* Stop Behaviour + Audio */}
                <div className="space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <ParkingCircle size={16} className="text-orange-400" />
                      <span className="text-xs font-black tracking-widest text-slate-500 uppercase">Stop Behaviour</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between font-mono text-[10px] text-slate-400">
                        <span>STATIONARY DURATION</span>
                        <span className="text-white">{stationaryTime}s</span>
                      </div>
                      <input type="range" min="0" max="300" step="5" value={stationaryTime}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setStationaryTime(v)
                          const stopScore = Math.min(1, v / 120)
                          setGpsFeatures({ stationary_time: v, stop_score: stopScore, confirmed_stop: v > 60 })
                        }}
                        className="w-full accent-orange-400 h-1 bg-white/5 rounded-full appearance-none"
                      />
                      <StopBadges />
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5">
                        {[{ label: 'MOVING', val: 0 }, { label: '2 MIN', val: 120 }, { label: '5 MIN', val: 300 }].map(p => (
                          <button key={p.label} onClick={() => {
                            setStationaryTime(p.val)
                            setGpsFeatures({ stationary_time: p.val, stop_score: Math.min(1, p.val / 120), confirmed_stop: p.val > 60 })
                          }} className="text-[9px] font-black tracking-widest text-slate-500 hover:text-primary bg-white/[0.03] hover:bg-primary/10 border border-white/5 rounded-xl py-1.5 transition-all">
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Mic size={14} className="text-slate-500" />
                      <span className="text-xs font-black tracking-widest text-slate-500 uppercase">In-Cab Audio (Support)</span>
                    </div>
                    <div className="flex justify-between font-mono text-[10px] text-slate-400">
                      <span>AUDIO AMPLITUDE (RMS)</span>
                      <span className="text-white">{cabAudioRms.toFixed(3)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.01" value={cabAudioRms}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setCabAudioRms(v)
                        setSensorFrame({ audio: { rms: v, screamScore: v > 0.3 ? 0.6 : 0, keyword: v > 0.4 ? 'help' : '', keyword_detected: v > 0.4 } })
                      }}
                      className="w-full accent-amber-400 h-1 bg-white/5 rounded-full appearance-none"
                    />
                    <div className="flex gap-2 flex-wrap mt-1 min-h-[20px]">
                      {cabAudioRms > 0.4  && <Badge color="red"    label="DISTRESS SIGNAL" />}
                      {cabAudioRms > 0.15 && cabAudioRms <= 0.4 && <Badge color="orange" label="ELEVATED AUDIO" />}
                      {cabAudioRms <= 0.05 && <Badge color="green" label="QUIET" />}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                      {[{ label: 'QUIET', v: 0.02 }, { label: 'TALK', v: 0.1 }, { label: 'SCREAM', v: 0.5 }].map(p => (
                        <button key={p.label} onClick={() => {
                          setCabAudioRms(p.v)
                          setSensorFrame({ audio: { rms: p.v, screamScore: p.v > 0.3 ? 0.6 : 0, keyword: p.v > 0.4 ? 'help' : '', keyword_detected: p.v > 0.4 } })
                        }} className="text-[9px] font-black tracking-widest text-slate-500 hover:text-primary bg-white/[0.03] hover:bg-primary/10 border border-white/5 rounded-xl py-1.5 transition-all">
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── WOMEN MODE controls ────────────────────────────────── */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

                {/* Kinetic Forces */}
                <div className="space-y-8">
                  <div className="flex items-center gap-2">
                    <ActivitySquare size={16} className="text-red-400" />
                    <span className="text-xs font-black tracking-widest text-slate-500 uppercase">Kinetic Forces</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between font-mono text-[10px] text-slate-400">
                      <span>ACCELERATION MAGNITUDE</span>
                      <span className="text-white">{motionAcc.toFixed(2)} G</span>
                    </div>
                    <input type="range" min="0" max="100" step="0.5" value={motionAcc}
                      onChange={(e) => { const v = Number(e.target.value); setMotionAcc(v); setSensorFrame({ motion: motionFromAcc(v) }) }}
                      className="w-full accent-primary h-1 bg-white/5 rounded-full appearance-none"
                    />
                    <MotionBadges />
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5">
                      {[{ label: 'WALK', val: 10 }, { label: 'FALL', val: 88 }, { label: 'RUN', val: 18 }].map(p => (
                        <button key={p.label} onClick={() => { setMotionAcc(p.val); setSensorFrame({ motion: motionFromAcc(p.val) }) }}
                          className="text-[9px] font-black tracking-widest text-slate-500 hover:text-primary bg-white/[0.03] hover:bg-primary/10 border border-white/5 rounded-xl py-1.5 transition-all">
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Acoustic Signals */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" />
                    <span className="text-xs font-black tracking-widest text-slate-500 uppercase">Acoustic Signals</span>
                  </div>

                  {[
                    { label: 'AUDIO AMPLITUDE (RMS)', val: audioRms, setter: setAudioRms, min: 0, max: 1, step: 0.01, color: 'accent-amber-400',
                      onChange: (v) => { setAudioRms(v); setSensorFrame({ audio: { rms: v, screamScore: screamFrom(v, zcr, freq) } }) } },
                    { label: 'ZERO CROSSING RATE (ZCR)', val: zcr, setter: setZcr, min: 0, max: 0.5, step: 0.01, color: 'accent-secondary',
                      onChange: (v) => { setZcr(v); setSensorFrame({ audio: { zcr: v, screamScore: screamFrom(audioRms, v, freq) } }) } },
                    { label: 'DOMINANT FREQUENCY', val: freq, setter: setFreq, min: 40, max: 8000, step: 10, color: 'accent-primary',
                      display: `${freq} Hz`,
                      onChange: (v) => { setFreq(v); setSensorFrame({ audio: { freq: v, screamScore: screamFrom(audioRms, zcr, v) } }) } },
                  ].map(s => (
                    <div key={s.label} className="space-y-3">
                      <div className="flex justify-between font-mono text-[10px] text-slate-400">
                        <span>{s.label}</span>
                        <span className="text-white">{s.display ?? s.val.toFixed(3)}</span>
                      </div>
                      <input type="range" min={s.min} max={s.max} step={s.step} value={s.val}
                        onChange={(e) => s.onChange(Number(e.target.value))}
                        className={`w-full ${s.color} h-1 bg-white/5 rounded-full appearance-none`}
                      />
                    </div>
                  ))}

                  <AudioBadges />

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                    {[
                      { label: 'QUIET',  rms: 0.02, z: 0.05, f: 300  },
                      { label: 'TALK',   rms: 0.08, z: 0.12, f: 900  },
                      { label: 'SCREAM', rms: 0.48, z: 0.38, f: 2900 },
                    ].map(p => (
                      <button key={p.label} onClick={() => {
                        setAudioRms(p.rms); setZcr(p.z); setFreq(p.f)
                        setSensorFrame({ audio: { rms: p.rms, zcr: p.z, freq: p.f, screamScore: screamFrom(p.rms, p.z, p.f) } })
                      }} className="text-[9px] font-black tracking-widest text-slate-500 hover:text-primary bg-white/[0.03] hover:bg-primary/10 border border-white/5 rounded-xl py-1.5 transition-all">
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Live Risk Index */}
          <div className="glass rounded-3xl p-6 border" style={{ borderColor: `${threatColor}30` }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} style={{ color: threatColor }} />
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Live Risk Index</h4>
            </div>
            <div className="text-center mb-4">
              <motion.div
                key={Math.round(combinedScore)}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-6xl font-display font-black tabular-nums"
                style={{ color: threatColor }}
              >
                {Math.round(combinedScore)}
              </motion.div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">/ 100 RISK SCORE</div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black tracking-widest px-3 py-1 rounded-full" style={{ backgroundColor: `${threatColor}20`, color: threatColor }}>
                  {threatLevel}
                </span>
                <div className="flex items-center gap-1">
                  <TrendIcon />
                  <span className="text-[9px] text-slate-500 font-mono">{trend}</span>
                </div>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ backgroundColor: threatColor }}
                  animate={{ width: `${Math.min(100, Math.max(0, combinedScore))}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-slate-600">
                <span>AVG {Math.round(movingAvg)}</span>
                <span>CONF {Math.round(confidence)}%</span>
              </div>
            </div>
          </div>

          {/* Engine Context */}
          <div className="glass rounded-3xl p-6 border border-white/5 bg-primary/5">
            <div className="flex items-center gap-2 mb-4">
              <Database size={16} className="text-primary" />
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Engine Context</h4>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-xs text-slate-500 font-medium">Platform Mode</span>
                <span className={`text-xs font-black uppercase ${isCab ? 'text-blue-400' : 'text-primary'}`}>{applicationMode}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-xs text-slate-500 font-medium">Primary Signal</span>
                <span className="text-xs text-white font-black">{isCab ? 'GPS / Route' : 'Audio'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-xs text-slate-500 font-medium">Injection Rate</span>
                <span className="text-xs text-white font-black">1.0 Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500 font-medium">Tunneling</span>
                <span className="text-[10px] text-green-400 font-black font-mono">ACTIVE</span>
              </div>
            </div>
          </div>

          {/* Engine Signals */}
          {reasons && reasons.length > 0 && (
            <div className="glass rounded-3xl p-6 border border-white/5">
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4">ENGINE SIGNALS</h4>
              <div className="space-y-2">
                {reasons.slice(0, 6).map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: threatColor }} />
                    <span className="text-[10px] text-slate-400 font-medium leading-relaxed">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FSM Advisory */}
          {recommendation && (
            <div className="glass rounded-3xl p-6 border border-white/5">
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3">FSM ADVISORY</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{recommendation}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
