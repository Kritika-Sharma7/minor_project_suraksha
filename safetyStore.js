import { create } from 'zustand'

const THREAT_META = {
  SAFE:       { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  label: 'SAFE',       priority: 0 },
  SUSPICIOUS: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'SUSPICIOUS', priority: 1 },
  HIGH:       { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'HIGH',       priority: 2 },
  CRITICAL:   { color: '#ef4444', bg: 'rgba(239,68,68,0.18)',  label: 'CRITICAL',   priority: 3 },
}

export const useSafetyStore = create((set, get) => ({
  // ── Risk inputs (0-255)
  locationRisk: 0,
  timeRisk:     0,
  motionRisk:   0,
  audioRisk:    0,
  audioClass:   'N/A',

  // ── Engine output
  threatLevel:    'SAFE',
  combinedScore:  0,
  movingAvg:      0,
  windowScores:   [],
  recommendation: 'Environment appears safe. Continue monitoring.',
  stateColor:     '#22c55e',
  alertTriggered: false,

  // ── History
  history: [],        // [{timestamp, threatLevel, combinedScore, inputs}]
  chartData: [],      // last 30 points for recharts

  // ── Audio
  audioFile:     null,
  audioResult:   null,
  audioLoading:  false,

  // ── UI state
  isAnalyzing:    false,
  alertCountdown: 0,   // seconds remaining in countdown
  lastAlertTime:  null,
  wsConnected:    false,

  // ── Setters
  setInput: (key, val) => set({ [key]: Math.max(0, Math.min(255, Number(val))) }),

  setAnalysisResult: (data) => {
    const now = Date.now()
    const snap = {
      timestamp:     now,
      threatLevel:   data.threat_level,
      combinedScore: data.combined_score,
      movingAvg:     data.moving_avg,
      inputs: {
        location: get().locationRisk,
        time:     get().timeRisk,
        motion:   get().motionRisk,
        audio:    get().audioRisk,
      },
      alertTriggered: data.alert_triggered,
    }

    const newHistory = [snap, ...get().history].slice(0, 100)
    const newChart   = [
      ...get().chartData,
      {
        time:          new Date(now).toLocaleTimeString(),
        score:         Math.round(data.combined_score),
        avg:           Math.round(data.moving_avg),
        threatLevel:   data.threat_level,
      },
    ].slice(-30)

    set({
      threatLevel:    data.threat_level,
      combinedScore:  data.combined_score,
      movingAvg:      data.moving_avg,
      windowScores:   data.window_scores || [],
      recommendation: data.recommendation,
      stateColor:     data.state_color,
      alertTriggered: data.alert_triggered,
      history:        newHistory,
      chartData:      newChart,
    })

    if (data.alert_triggered) {
      set({ lastAlertTime: now, alertCountdown: 60 })
    }
  },

  setAudioResult: (result) => set({
    audioResult:  result,
    audioRisk:    result.risk_score,
    audioClass:   result.audio_class,
    audioLoading: false,
  }),

  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setAudioLoading: (v) => set({ audioLoading: v }),
  setAudioFile: (f) => set({ audioFile: f }),
  setWsConnected: (v) => set({ wsConnected: v }),
  tickCountdown: () => set((s) => ({ alertCountdown: Math.max(0, s.alertCountdown - 1) })),

  getThreatMeta: () => THREAT_META[get().threatLevel] || THREAT_META.SAFE,
}))
