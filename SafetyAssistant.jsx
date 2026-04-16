import React from 'react'
import { Bot, PhoneCall, MapPinned, CircleAlert } from 'lucide-react'
import { useSafetyStore } from './safetyStore'

const ICONS = {
  call: PhoneCall,
  map: MapPinned,
  alert: CircleAlert,
}

function iconForAction(text) {
  const t = text.toLowerCase()
  if (t.includes('call')) return ICONS.call
  if (t.includes('navigate') || t.includes('location')) return ICONS.map
  return ICONS.alert
}

export default function SafetyAssistant() {
  const { assistantActions, threatLevel, contacts } = useSafetyStore()

  return (
    <div className="glass rounded-2xl p-5 border border-sky-500/20">
      <div className="flex items-center gap-2 mb-3">
        <Bot size={15} className="text-sky-300" />
        <h2 className="font-display font-bold text-sm tracking-widest text-white">AI SAFETY ASSISTANT</h2>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Current state: <span className="text-white font-semibold">{threatLevel}</span>
      </p>

      <div className="space-y-2">
        {assistantActions.length === 0 ? (
          <p className="text-xs text-slate-500">No urgent actions right now. Keep monitoring sensors.</p>
        ) : (
          assistantActions.map((action, idx) => {
            const Icon = iconForAction(action)
            return (
              <div key={`${action}-${idx}`} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-200 flex items-start gap-2">
                <Icon size={12} className="mt-0.5 text-sky-300" />
                <span>{action}</span>
              </div>
            )
          })
        )}
      </div>

      <p className="text-[10px] text-slate-600 mt-3 font-mono">
        Emergency contacts loaded: {contacts.length}
      </p>
    </div>
  )
}
