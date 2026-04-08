import React, { useState } from 'react'
import { Bell, BellOff, Timer, PhoneCall } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSafetyStore } from '../store/safetyStore'
import { useCountdown } from '../hooks/useCountdown'
import { triggerAlert } from '../utils/api'
import toast from 'react-hot-toast'

export default function AlertPanel() {
  const { threatLevel, combinedScore, locationRisk, timeRisk, motionRisk, audioRisk, audioClass, lastAlertTime } = useSafetyStore()
  const countdown = useCountdown()
  const [sending, setSending] = useState(false)
  const [alertStatus, setAlertStatus] = useState(null)

  const isCritical = threatLevel === 'CRITICAL'
  const cooldownActive = countdown > 0

  const handleManualAlert = async () => {
    if (sending) return
    setSending(true)
    try {
      const result = await triggerAlert({
        threat_level:   threatLevel,
        combined_score: combinedScore,
        location_risk:  locationRisk,
        time_risk:      timeRisk,
        motion_risk:    motionRisk,
        audio_risk:     audioRisk,
        audio_class:    audioClass,
      })
      setAlertStatus(result)
      toast.success('Emergency alert sent!')
    } catch (err) {
      toast.error(`Alert failed: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="glass rounded-2xl p-5 relative overflow-hidden"
      style={{ borderColor: isCritical ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)' }}
    >
      {/* Critical background pulse */}
      <AnimatePresence>
        {isCritical && (
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            animate={{ opacity: [0.05, 0.12, 0.05] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ background: 'radial-gradient(circle at 50% 0%, #ef444430, transparent 70%)' }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <motion.div
            animate={isCritical ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            {isCritical ? (
              <Bell size={16} className="text-red-400" />
            ) : (
              <BellOff size={16} className="text-slate-500" />
            )}
          </motion.div>
          <h2 className="font-display font-bold text-sm tracking-widest text-white">ALERT SYSTEM</h2>
        </div>
      </div>

      {/* Countdown timer */}
      <AnimatePresence>
        {cooldownActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 mb-4 p-3 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <Timer size={16} className="text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-red-300 font-mono">NEXT ALERT IN</p>
              <motion.p
                className="font-display font-bold text-2xl text-red-400 leading-none"
                animate={{ opacity: [1, 0.6, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
              </motion.p>
            </div>
            <div className="w-10 h-10 relative">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(239,68,68,0.2)" strokeWidth="3" />
                <motion.circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke="#ef4444" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 15}`}
                  animate={{ strokeDashoffset: 2 * Math.PI * 15 * (1 - countdown / 60) }}
                />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert status */}
      {alertStatus && (
        <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs font-mono text-slate-400 mb-1">LAST ALERT STATUS</p>
          <div className="flex gap-3 text-xs">
            <span className={alertStatus.sms_sent   ? 'text-green-400' : 'text-slate-600'}>
              📱 SMS {alertStatus.sms_sent ? 'Sent' : 'Failed'}
            </span>
            <span className={alertStatus.email_sent ? 'text-green-400' : 'text-slate-600'}>
              📧 Email {alertStatus.email_sent ? 'Sent' : 'Failed'}
            </span>
          </div>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{alertStatus.timestamp}</p>
        </div>
      )}

      {/* Manual trigger */}
      <motion.button
        onClick={handleManualAlert}
        disabled={sending}
        whileTap={{ scale: 0.96 }}
        className="w-full py-3 rounded-xl font-display font-bold tracking-widest text-sm flex items-center justify-center gap-2 transition-all"
        style={{
          background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.1))',
          border: '1px solid rgba(239,68,68,0.5)',
          color: '#ef4444',
          boxShadow: '0 0 16px rgba(239,68,68,0.2)',
          opacity: sending ? 0.6 : 1,
        }}
      >
        <PhoneCall size={15} />
        {sending ? 'SENDING…' : 'SOS PANIC BUTTON'}
      </motion.button>

      <p className="text-[10px] text-slate-600 text-center mt-2 font-mono">
        Sends SMS + Email to emergency contacts
      </p>
    </div>
  )
}
