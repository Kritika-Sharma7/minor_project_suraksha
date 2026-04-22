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
  trend:          'STABLE',
  recommendation: 'All sensors normal. You are safe.',
  stateColor:     '#22c55e',
  alertTriggered: false,
  riskDelta:      0,
  liveEvents:     [],
  reasons:        [],
  confidence:     0,
  dangerStreak:   0,
  countdownMax:   5,
  reliability:    { gps: 1.0, audio: 1.0, motion: 1.0 },
  weights:        { location: 0.25, time: 0.15, motion: 0.35, audio: 0.25 },

  // ── History
  history: [],        // [{timestamp, threatLevel, combinedScore, inputs}]
  chartData: [],      // last 30 points for recharts
  incidents: [],
  mapPoints: [],

  // ── Audio
  audioFile:     null,
  audioResult:   null,
  audioLoading:  false,
  speechActive:   false,   // SpeechRecognition is currently listening
  lastTranscript: '',      // last phrase heard (any, not just keywords)

  // ── Simulation
  simulationActive: false,

  // ── UI state
  activeView:      'dashboard',
  applicationMode: 'women',   // 'women' | 'cab'
  isAnalyzing:    false,
  alertCountdown: 0,   // seconds remaining in countdown
  lastAlertTime:  null,
  wsConnected:    false,
  wsSender:       null,
  routeStatus:    null,
  profile: {
    name: 'Primary User',
    alert_threshold: 192,
    safe_zones: [],
  },
  contacts: [],
  assistantActions: [],

  // ── GPS Behavioral Features (from gpsProcessor.js 3-layer pipeline) ────────
  // Signal Layer  → raw GPS coords from navigator.geolocation
  // Feature Layer → distance, speed, stationary_time, distance_from_route, scores
  // Decision Layer→ confirmed_stop, confirmed_deviation, risk
  gpsFeatures: {
    speed: 0,                  // m/s — Feature Layer
    stationary_time: 0,        // cumulative seconds stopped — Feature Layer
    confirmed_stop: false,     // Decision Layer (≥3 consecutive slow frames)
    stop_score: 0,             // 0–1 normalized — Feature Layer
    deviation_score: 0,        // 0–1 normalized — Feature Layer
    confirmed_deviation: false, // Decision Layer (≥3 consecutive off-route frames)
    distance_from_route: 0,    // metres — Signal Layer (raw geometric)
    risk: 0,                   // 0–1 — Decision Layer
    risk_255: 0,               // 0–255 for backend scale
    label: 'Normal',           // Normal | Suspicious | High | Critical
  },

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
      keyword: get().sensorFrame?.audio?.keyword || '',
    }

    // Only add to the event log when:
    //   (a) threat level changed from previous entry, OR
    //   (b) it's a non-SAFE event (always capture threats), OR
    //   (c) 60 seconds have elapsed since the last SAFE entry
    const prev     = get().history[0]
    const isThreat = data.threat_level !== 'SAFE'
    const levelChanged = !prev || prev.threatLevel !== data.threat_level
    const minutePassed = !prev || (now - prev.timestamp) >= 60_000
    const shouldLog = isThreat || levelChanged || minutePassed

    const existing = get().history
    let newHistory = existing
    if (shouldLog) {
      const withSnap = [snap, ...existing]
      // Keep all threat (non-SAFE) entries (up to 50) + only last 5 SAFE entries
      const threats = withSnap.filter(h => h.threatLevel !== 'SAFE').slice(0, 50)
      const safes   = withSnap.filter(h => h.threatLevel === 'SAFE').slice(0, 5)
      // Threats pinned at top, SAFE entries appended below sorted by time
      newHistory = [...threats, ...safes]
    }
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
      windowScores:   data.window_scores || [],
      recommendation: data.recommendation,
      stateColor:     data.state_color,
      alertTriggered: data.alert_triggered,
      history:        shouldLog ? newHistory : existing,
      chartData:      newChart,
      locationRisk:   data.inputs?.location ?? get().locationRisk,
      timeRisk:       data.inputs?.time ?? get().timeRisk,
      motionRisk:     data.inputs?.motion ?? get().motionRisk,
      audioRisk:      data.inputs?.audio ?? get().audioRisk,
      dangerStreak:   data.danger_streak || 0,
      countdownMax:   data.countdown_max || 5,
      reliability:    data.reliability || get().reliability,
      weights:        data.weights || get().weights,
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

  setSpeechActive: (v) => set({ speechActive: v }),
  setLastTranscript: (t) => set({ lastTranscript: t }),
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setAudioLoading: (v) => set({ audioLoading: v }),
  setAudioFile: (f) => set({ audioFile: f }),
  setWsConnected: (v) => set({ wsConnected: v }),
  setWsSender: (fn) => set({ wsSender: fn }),
  sendWsMessage: (message) => {
    const sender = get().wsSender
    if (!sender) return false
    return sender(message)
  },
  setRouteStatus: (status) => set({ routeStatus: status }),
  tickCountdown: () => set((s) => ({ alertCountdown: Math.max(0, s.alertCountdown - 1) })),

  setGpsFeatures: (f) => set((s) => ({ gpsFeatures: { ...s.gpsFeatures, ...f } })),
  setSimulationActive: (v) => set({ simulationActive: v }),
  setWeights: (w) => set({ weights: w || get().weights }),

  getThreatMeta: () => THREAT_META[get().threatLevel] || THREAT_META.SAFE,
}))
