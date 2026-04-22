import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, User, Phone, Mail, Plus, Trash2,
  ChevronRight, CheckCircle, Car, Users, AlertCircle,
} from 'lucide-react'
import { updateProfile, addContact } from './apiClient'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 'personal',  label: 'Personal Info',       icon: User    },
  { id: 'contacts',  label: 'Emergency Contacts',   icon: Phone   },
  { id: 'mode',      label: 'Choose Mode',          icon: Shield  },
]

const MODES = [
  {
    id: 'women',
    title: 'Women Safety Mode',
    icon: Users,
    color: '#4edea3',
    tagline: 'Detects personal distress situations',
    description: 'Audio and motion are the PRIMARY signals. Use this mode when you are walking, commuting alone, or in any situation where personal safety is the concern.',
    signals: [
      '🎤 Distress keywords (help, bachao, chhodo)',
      '📱 Motion patterns — jerk, fall, struggle',
      '🕒 Night-time elevated sensitivity',
      '📍 GPS for location sharing only',
    ],
  },
  {
    id: 'cab',
    title: 'Cab Safety Mode',
    icon: Car,
    color: '#60a5fa',
    tagline: 'Detects unsafe journey behavior',
    description: 'GPS route deviation is the PRIMARY signal. Use this when you are in a cab, auto, or any hired vehicle — the system monitors the journey for anomalies.',
    signals: [
      '📍 Route deviation from expected path',
      '🛑 Unusual stop — location + duration',
      '🚗 Speed anomalies (too slow / wrong area)',
      '🎤 Audio as a support signal',
    ],
  },
]

export default function ProfileSetup({ onComplete }) {
  const [step, setStep]       = useState(0)
  const [name, setName]       = useState('')
  const [phone, setPhone]     = useState('')
  const [contacts, setContacts] = useState([{ name: '', phone: '', email: '' }])
  const [mode, setMode]       = useState('women')
  const [saving, setSaving]   = useState(false)

  const addRow = () =>
    setContacts(prev => [...prev, { name: '', phone: '', email: '' }])

  const removeRow = (i) =>
    setContacts(prev => prev.filter((_, idx) => idx !== i))

  const updateRow = (i, field, val) =>
    setContacts(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      return next
    })

  const canProceed = () => {
    if (step === 0) return name.trim().length >= 2
    if (step === 1) return contacts.some(c => c.name.trim() && (c.phone.trim() || c.email.trim()))
    return true
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      await updateProfile({ name: name.trim(), alert_threshold: 192 })
      for (const c of contacts) {
        if (c.name.trim() && (c.phone.trim() || c.email.trim())) {
          await addContact({ name: c.name.trim(), phone: c.phone.trim(), email: c.email.trim() })
        }
      }
    } catch {
      // proceed even if backend is unreachable
    }
    localStorage.setItem('suraksha_profile', JSON.stringify({
      name: name.trim(), phone: phone.trim(), mode, complete: true,
    }))
    toast.success(`Profile saved. Starting ${mode === 'women' ? 'Women Safety' : 'Cab'} Mode…`)
    setSaving(false)
    onComplete(mode)
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-lg relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
            <Shield size={32} className="text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">SURAKSHA</h1>
          <p className="text-slate-400 text-sm mt-1">Set up your safety profile to get started</p>
        </div>

        {/* Step progress bar */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  i === step
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : i < step
                    ? 'bg-green-500/15 text-green-400 border border-green-500/30 cursor-pointer'
                    : 'bg-white/5 text-slate-600 border border-white/10 cursor-default'
                }`}
              >
                {i < step
                  ? <CheckCircle size={12} />
                  : <s.icon size={12} />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-px ${i < step ? 'bg-green-500/40' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22 }}
            className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl"
          >

            {/* ── Step 0: Personal Info ── */}
            {step === 0 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Tell us about yourself</h2>
                  <p className="text-slate-400 text-sm">Your name is shown to emergency contacts when an alert fires</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                      Your Name *
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        autoFocus
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-primary/50 focus:outline-none focus:bg-white/[0.07] transition-all"
                      />
                    </div>
                    {name.length > 0 && name.trim().length < 2 && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle size={11} /> Enter at least 2 characters
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                      Your Phone (optional)
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-primary/50 focus:outline-none focus:bg-white/[0.07] transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 1: Emergency Contacts ── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Emergency Contacts</h2>
                  <p className="text-slate-400 text-sm">These people get an SMS + email when an alert fires. Add at least one.</p>
                </div>

                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {contacts.map((c, i) => (
                    <div
                      key={i}
                      className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Contact {i + 1}
                        </span>
                        {contacts.length > 1 && (
                          <button
                            onClick={() => removeRow(i)}
                            className="text-slate-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <input
                        value={c.name}
                        onChange={e => updateRow(i, 'name', e.target.value)}
                        placeholder="Contact name *"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-600 focus:border-primary/40 focus:outline-none transition-all"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                          <input
                            value={c.phone}
                            onChange={e => updateRow(i, 'phone', e.target.value)}
                            placeholder="Phone"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-primary/40 focus:outline-none transition-all"
                          />
                        </div>
                        <div className="relative">
                          <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                          <input
                            value={c.email}
                            onChange={e => updateRow(i, 'email', e.target.value)}
                            placeholder="Email"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-primary/40 focus:outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addRow}
                  className="w-full py-2.5 border border-dashed border-white/20 rounded-xl text-slate-400 hover:text-white hover:border-white/40 transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> Add another contact
                </button>

                {!canProceed() && contacts.some(c => c.name.trim() && !c.phone.trim() && !c.email.trim()) && (
                  <p className="text-amber-400/80 text-xs flex items-center gap-1.5">
                    <AlertCircle size={12} /> Each contact needs at least a phone or email
                  </p>
                )}
              </div>
            )}

            {/* ── Step 2: Mode Selection ── */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Choose Your Protection Mode</h2>
                  <p className="text-slate-400 text-sm">This determines how Suraksha weights sensor signals. You can change it anytime.</p>
                </div>

                <div className="space-y-4">
                  {MODES.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                        mode === m.id
                          ? 'border-primary/60 bg-primary/[0.07]'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${m.color}20` }}
                        >
                          <m.icon size={20} style={{ color: m.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{m.title}</span>
                            {mode === m.id && (
                              <CheckCircle size={15} className="text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{m.tagline}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mb-3 leading-relaxed">{m.description}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {m.signals.map(s => (
                          <div key={s} className="text-[11px] text-slate-400">{s}</div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-5">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3.5 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:border-white/25 transition-all font-medium text-sm"
            >
              Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                canProceed()
                  ? 'bg-primary text-[#0a0e17] hover:brightness-110 shadow-[0_0_20px_rgba(78,222,163,0.3)]'
                  : 'bg-white/10 text-slate-500 cursor-not-allowed'
              }`}
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex-1 py-3.5 bg-primary text-[#0a0e17] rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(78,222,163,0.3)]"
            >
              {saving ? 'Setting up…' : 'Start Suraksha'}
              {!saving && <Shield size={16} />}
            </button>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          Your data stays on your device. No accounts required.
        </p>
      </div>
    </div>
  )
}
