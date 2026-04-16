import React, { useEffect, useState } from 'react'
import { User, Save, Plus } from 'lucide-react'
import { addContact, getContacts, getProfile, updateProfile } from './apiClient'
import { useSafetyStore } from './safetyStore'
import toast from 'react-hot-toast'

export default function UserProfilePanel() {
  const { profile, contacts, setProfile, setContacts } = useSafetyStore()
  const [name, setName] = useState(profile.name)
  const [threshold, setThreshold] = useState(profile.alert_threshold || 192)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const p = await getProfile()
        const c = await getContacts()
        setProfile(p)
        setContacts(c.items || [])
        setName(p.name)
        setThreshold(p.alert_threshold)
      } catch {
        // non-blocking
      }
    }
    load()
  }, [])

  const saveProfile = async () => {
    try {
      const updated = await updateProfile({
        name,
        alert_threshold: Number(threshold),
        safe_zones: profile.safe_zones || [],
      })
      setProfile(updated)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const addNewContact = async () => {
    if (!contactName.trim()) {
      toast.error('Contact name is required')
      return
    }
    try {
      await addContact({ name: contactName, phone: contactPhone || null, email: contactEmail || null })
      const c = await getContacts()
      setContacts(c.items || [])
      setContactName('')
      setContactPhone('')
      setContactEmail('')
      toast.success('Emergency contact added')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <User size={14} className="text-slate-300" />
        <h2 className="font-display font-bold text-sm tracking-widest text-white">USER PROFILE</h2>
      </div>

      <div className="space-y-2 mb-3">
        <input
          className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          min={64}
          max={255}
          className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Alert threshold"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
        <button onClick={saveProfile} className="w-full rounded-lg py-2 bg-blue-500/20 border border-blue-400/40 text-blue-200 text-xs font-mono flex items-center justify-center gap-2">
          <Save size={12} /> SAVE PROFILE
        </button>
      </div>

      <div className="border-t border-white/10 pt-3">
        <p className="text-xs text-slate-400 mb-2 font-mono">EMERGENCY CONTACTS</p>
        <div className="space-y-2 mb-2">
          <input className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" placeholder="Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <input className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" placeholder="Phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          <input className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <button onClick={addNewContact} className="w-full rounded-lg py-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-mono flex items-center justify-center gap-2">
            <Plus size={12} /> ADD CONTACT
          </button>
        </div>

        <div className="max-h-28 overflow-y-auto space-y-1">
          {contacts.map((c) => (
            <div key={c.id} className="text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-md px-2 py-1">
              <p className="font-semibold text-white">{c.name}</p>
              <p>{c.phone || 'no phone'} {c.email ? `| ${c.email}` : ''}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
