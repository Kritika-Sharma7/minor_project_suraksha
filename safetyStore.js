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

  // ── Live sensors
  sensorFrame: {
    location: { lat: null, lon: null, accuracy: null, speed: 0, isolation: 0.5 },
    motion: { accelMag: 0, gyroMag: 0, shakeScore: 0, fallProb: 0, runningScore: 0 },
    audio: { rms: 0, screamScore: 0, zcr: 0, freqEnergy: 0, keyword: '', audioClass: 'N/A' },
  },
  sensorsEnabled: {
    microphone: false,
    motion: false,
    location: false,
  },
  backgroundMonitoring: true,

  // ── Engine output
  threatLevel:    'SAFE',
  combinedScore:  0,
  movingAvg:      0,
  windowScores:   [],
  recommendation: 'Environment appears safe. Continue monitoring.',
  stateColor:     '#22c55e',
  alertTriggered: false,
  riskDelta: 0,
  liveEvents: [],
  reasons: [],
  confidence: 0,
  weights: { location: 0.3, time: 0.2, motion: 0.3, audio: 0.2 },

  // ── History
  history: [],        // [{timestamp, threatLevel, combinedScore, inputs}]
  chartData: [],      // last 30 points for recharts
  incidents: [],
  mapPoints: [],

  // ── Audio
  audioFile:     null,
  audioResult:   null,
  audioLoading:  false,

  // ── UI state
  activeView:     'dashboard',
  applicationMode:'women',
  isAnalyzing:    false,
  alertCountdown: 0,   // seconds remaining in countdown
  lastAlertTime:  null,
  wsConnected:    false,
  profile: {
    name: 'Primary User',
    alert_threshold: 192,
    safe_zones: [],
  },
  contacts: [],
  assistantActions: [],

  // ── Setters
  setInput: (key, val) => set({ [key]: Math.max(0, Math.min(255, Number(val))) }),

  setSensorEnabled: (key, value) =>
    set((s) => ({ sensorsEnabled: { ...s.sensorsEnabled, [key]: value } })),

  setBackgroundMonitoring: (value) => set({ backgroundMonitoring: value }),
  setActiveView: (view) => set({ activeView: view }),
  setApplicationMode: (mode) => set({ applicationMode: mode }),

  setSensorFrame: (framePatch) =>
    set((s) => ({
      sensorFrame: {
        ...s.sensorFrame,
        ...framePatch,
        location: { ...s.sensorFrame.location, ...(framePatch.location || {}) },
        motion: { ...s.sensorFrame.motion, ...(framePatch.motion || {}) },
        audio: { ...s.sensorFrame.audio, ...(framePatch.audio || {}) },
      },
    })),

  setAnalysisResult: (data) => {
    const now = Date.now()
    const snap = {
      timestamp:     now,
      threatLevel:   data.threat_level,
      combinedScore: data.combined_score,
      movingAvg:     data.moving_avg,
      trend:         data.trend,
      inputs: {
        location: get().locationRisk,
        time:     get().timeRisk,
        motion:   get().motionRisk,
        audio:    get().audioRisk,
      },
      alertTriggered: data.alert_triggered,
      confidence: data.confidence,
      reasons: data.reasons,
    }

    const newHistory = [snap, ...get().history].slice(0, 100)
    const newChart   = [
      ...get().chartData,
      {
        time:          new Date(now).toLocaleTimeString(),
        score:         Math.round(data.combined_score),
        avg:           Math.round(data.moving_avg),
        threatLevel:   data.threat_level,
        trend:         data.trend,
      },
    ].slice(-30)

    set({
      threatLevel:    data.threat_level,
      combinedScore:  data.combined_score,
      movingAvg:      data.moving_avg,
      riskDelta:      data.risk_delta || 0,
      trend:          data.trend || 'STABLE',
      liveEvents:     data.events || [],
      reasons:        data.reasons || [],
      confidence:     data.confidence || 0,
      weights:        data.weights || get().weights,
      windowScores:   data.window_scores || [],
      recommendation: data.recommendation,
      stateColor:     data.state_color,
      alertTriggered: data.alert_triggered,
      history:        newHistory,
      chartData:      newChart,
      locationRisk:   data.inputs?.location ?? get().locationRisk,
      timeRisk:       data.inputs?.time ?? get().timeRisk,
      motionRisk:     data.inputs?.motion ?? get().motionRisk,
      audioRisk:      data.inputs?.audio ?? get().audioRisk,
    })

    if (data.geo?.lat != null && data.geo?.lon != null) {
      set((s) => ({
        mapPoints: [
          {
            id: now,
            lat: data.geo.lat,
            lon: data.geo.lon,
            threat_level: data.threat_level,
            combined_score: data.combined_score,
            created_at: new Date(now).toISOString(),
          },
          ...s.mapPoints,
        ].slice(0, 200),
      }))
    }

    const actions = []
    if (data.threat_level === 'SUSPICIOUS') {
      actions.push('Share live location with a trusted contact')
    }
    if (data.threat_level === 'HIGH') {
      actions.push('Start recording audio and move toward a populated area')
      actions.push('Prepare SOS alert for emergency contacts')
    }
    if (data.threat_level === 'CRITICAL') {
      actions.push('Trigger SOS alert now')
      actions.push('Navigate to nearest safe zone')
      actions.push('Call emergency services')
    }
    if ((data.events || []).includes('FALL_DETECTED')) {
      actions.push('Possible fall detected, call for help immediately')
    }
    set({ assistantActions: actions })

    if (data.alert_triggered) {
      set({ lastAlertTime: now, alertCountdown: 60 })
    }
  },

  addIncident: (incident) =>
    set((s) => ({ incidents: [incident, ...s.incidents].slice(0, 200) })),

  setIncidents: (items) => set({ incidents: items || [] }),
  setMapPoints: (points) => set({ mapPoints: points || [] }),
  setProfile: (profile) => set({ profile: profile || get().profile }),
  setContacts: (contacts) => set({ contacts: contacts || [] }),

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
