import React, { useRef, useState } from 'react'
import { Upload, Mic, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSafetyStore } from './safetyStore'
import { detectAudio } from './apiClient'
import toast from 'react-hot-toast'

const CLASS_META = {
  scream:   { emoji: '🆘', color: '#ef4444', label: 'Scream Detected',   desc: 'Emergency audio detected' },
  distress: { emoji: '⚠️', color: '#f97316', label: 'Distress Sound',    desc: 'Possible distress signal' },
  fight:    { emoji: '🥊', color: '#f43f5e', label: 'Fight Sound',       desc: 'Aggressive altercation pattern detected' },
  normal:   { emoji: '✅', color: '#22c55e', label: 'Normal Audio',      desc: 'No threats detected' },
}

export default function AudioDetector() {
  const { audioResult, audioLoading, setAudioResult, setAudioLoading, setAudioFile } = useSafetyStore()
  const fileRef = useRef()
  const [dragging, setDragging] = useState(false)

  const processFile = async (file) => {
    if (!file) return
    setAudioFile(file)
    setAudioLoading(true)
    try {
      const result = await detectAudio(file)
      setAudioResult(result)
      toast.success(`Audio classified: ${result.audio_class.toUpperCase()}`)
    } catch (err) {
      toast.error(`Audio analysis failed: ${err.message}`)
      setAudioLoading(false)
    }
  }

  const onFileChange = (e) => processFile(e.target.files[0])
  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  const meta = audioResult ? CLASS_META[audioResult.audio_class] : null

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Mic size={15} className="text-slate-400" />
        <h2 className="font-display font-bold text-sm tracking-widest text-white">AUDIO ML DETECTION</h2>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="relative flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed cursor-pointer transition-all py-6"
        style={{
          borderColor: dragging ? '#60a5fa' : 'rgba(255,255,255,0.1)',
          background:  dragging ? 'rgba(96,165,250,0.05)' : 'rgba(255,255,255,0.02)',
        }}
      >
        {audioLoading ? (
          <Loader2 size={22} className="text-blue-400 animate-spin" />
        ) : (
          <Upload size={22} className="text-slate-500" />
        )}
        <p className="text-xs text-slate-500 text-center px-4">
          {audioLoading
            ? 'Analyzing audio…'
            : 'Drop WAV / MP3 or click to upload'}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* Result display */}
      <AnimatePresence>
        {audioResult && meta && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-xl p-4"
            style={{
              background: `${meta.color}12`,
              border: `1px solid ${meta.color}40`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{meta.emoji}</span>
                <div>
                  <p className="font-display font-bold text-sm" style={{ color: meta.color }}>
                    {meta.label}
                  </p>
                  <p className="text-xs text-slate-500">{meta.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-xl" style={{ color: meta.color }}>
                  {audioResult.risk_score}
                </p>
                <p className="text-[10px] text-slate-600 font-mono">/255 risk</p>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1">
                <span>CONFIDENCE</span>
                <span>{Math.round(audioResult.confidence * 100)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: meta.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${audioResult.confidence * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-mono mt-2">
              ↑ Audio risk score auto-applied to input dashboard
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
