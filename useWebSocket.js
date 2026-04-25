import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useSafetyStore } from './safetyStore'

// Must stay in sync with backend threat_engine.py _DISTRESS_KEYWORDS
// hi-IN lang transcribes English words into Devanagari (हेल्प, पुलिस, स्टॉप, डेंजर)
// so we match both the Latin and Devanagari forms.
const DISTRESS_KEYWORDS = [
  // English (Latin script)
  'help', 'bachao', 'stop', 'danger', 'save me',
  'please help', 'leave me', 'let me go', 'aao',
  'chhodo', 'chodo', 'mat karo', 'nahi', 'chodo mujhe', 'police',
  // Devanagari transliterations produced by hi-IN speech model
  'हेल्प',     // help
  'पुलिस',    // police
  'स्टॉप',    // stop
  'डेंजर',    // danger
  'बचाओ',     // bachao
  'छोड़ो',    // chhodo
  'मत करो',   // mat karo
  'नहीं',     // nahi
  'आओ',       // aao
]

export function useWebSocket() {
  const ws               = useRef(null)
  const audioContextRef  = useRef(null)
  const analyserRef      = useRef(null)
  const sensorTimerRef   = useRef(null)
  const recognitionRef   = useRef(null)
  const motionListenerRef = useRef(null)   // tracks devicemotion handler for cleanup
  const peakMotionRef     = useRef(null)   // highest-magnitude sample in current 1s window

  const {
    setWsConnected,
    setWsSender,
    setRouteStatus,
    setAnalysisResult,
    setSensorEnabled,
    setSensorFrame,
    setSpeechActive,
    setLastTranscript,
    addIncident,
  } = useSafetyStore()

  const backgroundMonitoring = useSafetyStore(s => s.backgroundMonitoring)
  const applicationMode      = useSafetyStore(s => s.applicationMode)

  useEffect(() => {
    let reconnectTimer

    // ── GPS ─────────────────────────────────────────────────────────────
    const startLocation = () => {
      if (!navigator.geolocation) return
      navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed } = pos.coords
          setSensorEnabled('location', true)
          setSensorFrame({
            location: {
              lat: latitude,
              lon: longitude,
              accuracy: accuracy || 0,
              speed: speed || 0,
              isolation: Math.max(0, Math.min(1, (accuracy || 0) / 200)),
            },
          })
        },
        () => setSensorEnabled('location', false),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      )
    }

    // ── Motion / Accelerometer ───────────────────────────────────────────
    const startMotion = () => {
      // Remove any existing listener before registering a new one.
      // Without this, every backgroundMonitoring toggle stacks a second listener.
      if (motionListenerRef.current) {
        window.removeEventListener('devicemotion', motionListenerRef.current)
        motionListenerRef.current = null
      }

      const onMotion = (event) => {
        const acc = event.accelerationIncludingGravity || event.acceleration || {}
        const rot = event.rotationRate || {}
        const ax = Number(acc.x || 0)
        const ay = Number(acc.y || 0)
        const az = Number(acc.z || 0)
        const gx = Number(rot.alpha || 0)
        const gy = Number(rot.beta  || 0)
        const gz = Number(rot.gamma || 0)

        const accelMag     = Math.sqrt(ax * ax + ay * ay + az * az)
        const gyroMag      = Math.sqrt(gx * gx + gy * gy + gz * gz)
        const shakeScore   = Math.max(0, Math.min(1, (accelMag - 9.8) / 20))
        const fallProb     = Math.max(0, Math.min(1, Math.abs(accelMag - 9.8) / 12))
        const runningScore = Math.max(0, Math.min(1, accelMag / 18))

        // Track the peak sample in each 1-second WebSocket window.
        // devicemotion fires at ~60 Hz; the WS frame only sends once per second.
        // Without peak-tracking, a 100ms spike (fall, strike) is invisible because
        // the next setSensorFrame call 16ms later overwrites it with a normal value.
        const current = peakMotionRef.current
        if (!current || accelMag > current.accelMag) {
          peakMotionRef.current = { accelMag, gyroMag, shakeScore, fallProb, runningScore }
        }

        setSensorEnabled('motion', true)
        setSensorFrame({ motion: { accelMag, gyroMag, shakeScore, fallProb, runningScore } })
      }

      motionListenerRef.current = onMotion

      // iOS: request permission if needed (will silently fail on mount; the
      // browser will ask when the user first interacts with the page)
      if (
        typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function'
      ) {
        DeviceMotionEvent.requestPermission()
          .then(r => { if (r === 'granted') console.log('Motion perm granted') })
          .catch(() => {})
      }
      window.addEventListener('devicemotion', onMotion)
    }

    // ── Microphone + Web Audio (RMS / ZCR metrics) ──────────────────────
    // SpeechRecognition already claims the mic for keyword detection.
    // getUserMedia gives us a parallel AudioContext for RMS/ZCR energy
    // analysis. A GainNode (8×) amplifies the signal so readings on low-gain
    // laptop mics still reach usable levels for the backend's thresholds.
    const startMicrophone = () => {
      const initMic = () => {
        if (!navigator.mediaDevices?.getUserMedia) return
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then((stream) => {
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            if (!AudioCtx) return
            audioContextRef.current = new AudioCtx()
            const source  = audioContextRef.current.createMediaStreamSource(stream)

            // Amplify the raw mic signal 8× so laptop mics with low gain
            // produce RMS readings that actually cross distress thresholds
            const gainNode = audioContextRef.current.createGain()
            gainNode.gain.value = 8

            analyserRef.current = audioContextRef.current.createAnalyser()
            analyserRef.current.fftSize = 1024

            source.connect(gainNode)
            gainNode.connect(analyserRef.current)

            setSensorEnabled('microphone', true)
            console.log('[Suraksha] AudioContext started with 8× gain — RMS/ZCR active')
          })
          .catch((err) => {
            console.warn('[Suraksha] getUserMedia failed (SpeechRecognition still active):', err.message)
          })
      }

      initMic()

      // iOS / strict browsers: retry on first user interaction
      const fallbackMic = () => {
        if (!analyserRef.current) initMic()
        window.removeEventListener('click',      fallbackMic)
        window.removeEventListener('touchstart', fallbackMic)
      }
      window.addEventListener('click',      fallbackMic)
      window.addEventListener('touchstart', fallbackMic)
    }

    // ── Speech Recognition (keyword detection) ───────────────────────────
    const keywordClearTimerRef = { current: null }

    const startKeywordDetection = () => {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!Recognition) {
        console.warn('[Suraksha] SpeechRecognition not supported. Use Chrome on localhost or HTTPS.')
        return
      }

      // Stop and discard any existing instance before creating a new one.
      // Without this, WebSocket reconnects spawn a second recognition that
      // immediately conflicts and causes an infinite abort loop.
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null   // prevent the old instance from restarting
          recognitionRef.current.abort()
        } catch { /* already stopped */ }
        recognitionRef.current = null
      }

      const rec = new Recognition()
      // hi-IN recognizes both Hindi (bachao, chhodo, nahi) and common English
      // distress words (help, police, stop) due to code-switching in Indian speech.
      rec.lang = 'hi-IN'
      rec.interimResults  = true
      rec.continuous      = true
      rec.maxAlternatives = 1

      // Track consecutive aborts so we can back off instead of tight-looping.
      let consecutiveAborts = 0

      rec.onresult = (evt) => {
        consecutiveAborts = 0  // a result means the recognition is healthy
        for (let ri = evt.resultIndex; ri < evt.results.length; ri++) {
          const result = evt.results[ri]
          const transcript = (result[0]?.transcript || '').toLowerCase().trim()
          if (!transcript) continue

          if (result.isFinal) setLastTranscript(transcript)
          console.log(`[Suraksha] Heard (${result.isFinal ? 'final' : 'interim'}):`, transcript)

          const matched = DISTRESS_KEYWORDS.find(kw => transcript.includes(kw))
          if (matched) {
            const currentKeyword = useSafetyStore.getState().sensorFrame?.audio?.keyword
            if (currentKeyword === matched) continue

            console.log('[Suraksha] KEYWORD MATCHED:', matched, '| transcript:', transcript)
            setSensorEnabled('microphone', true)
            setSensorFrame({ audio: { keyword: matched, keyword_detected: true } })

            toast.error(`Distress keyword: "${matched}"`, {
              duration: 4000,
              style: { background: '#1e1e2e', color: '#ef4444', border: '1px solid #ef444440' },
            })

            sendFrame()

            if (keywordClearTimerRef.current) clearTimeout(keywordClearTimerRef.current)
            keywordClearTimerRef.current = setTimeout(() => {
              setSensorFrame({ audio: { keyword: '', keyword_detected: false } })
              console.log('[Suraksha] Keyword cleared from store')
            }, 6000)
          }
        }
      }

      rec.onsoundstart  = () => { setSpeechActive(true) }
      rec.onspeechstart = () => { setSpeechActive(true) }
      rec.onspeechend   = () => { setSpeechActive(false) }

      rec.onerror = (evt) => {
        setSpeechActive(false)
        if (evt.error === 'aborted') {
          // 'aborted' fires when we called abort() ourselves (e.g. cleanup above).
          // Increment counter so onend uses a back-off delay instead of restarting instantly.
          consecutiveAborts++
          return
        }
        consecutiveAborts = 0
        if (evt.error === 'not-allowed') {
          toast.error('Microphone permission denied. Please allow mic access.', { duration: 5000 })
        } else if (evt.error === 'network') {
          console.warn('[Suraksha] SpeechRecognition needs internet. Keyword detection may be unavailable.')
        } else {
          console.warn('[Suraksha] SpeechRecognition error:', evt.error)
        }
      }

      rec.onend = () => {
        setSpeechActive(false)
        // If this instance was replaced (ref no longer points to it), do NOT restart.
        if (recognitionRef.current !== rec) return

        // Back off exponentially on repeated aborts to break infinite-restart loops.
        // Normal natural end (every ~60 s) has consecutiveAborts === 0 → 200 ms restart.
        const delay = consecutiveAborts > 5 ? 10000
                    : consecutiveAborts > 2 ? 3000
                    : consecutiveAborts > 0 ? 1000
                    : 200
        setTimeout(() => {
          if (recognitionRef.current !== rec) return  // replaced while waiting
          try { rec.start() } catch { /* already running */ }
        }, delay)
      }

      recognitionRef.current = rec
      try {
        rec.start()
        console.log('[Suraksha] SpeechRecognition started (lang: hi-IN, continuous)')
        setSensorEnabled('microphone', true)
      } catch (e) {
        console.warn('[Suraksha] SpeechRecognition failed to start:', e)
      }
    }

    // ── Audio Metrics (RMS / ZCR / dominant freq) ────────────────────────
    const getAudioMetrics = () => {
      if (!analyserRef.current) return { rms: 0, screamScore: 0, zcr: 0, freq: 0 }

      const bufLen   = analyserRef.current.fftSize
      const timeDom  = new Uint8Array(bufLen)
      analyserRef.current.getByteTimeDomainData(timeDom)

      let sum = 0, crossings = 0, lastSign = 0
      for (let i = 0; i < bufLen; i++) {
        const v    = (timeDom[i] - 128) / 128
        sum       += v * v
        const sign = Math.sign(timeDom[i] - 128)
        if (lastSign !== 0 && sign !== 0 && sign !== lastSign) crossings++
        if (sign !== 0) lastSign = sign
      }

      const rms = Math.sqrt(sum / bufLen)
      const zcr = crossings / (bufLen - 1)

      const freqDom = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(freqDom)

      let maxVal = -1, maxIdx = 0
      freqDom.forEach((v, i) => { if (v > maxVal) { maxVal = v; maxIdx = i } })
      const nyquist = analyserRef.current.context.sampleRate / 2
      const freq    = maxIdx * (nyquist / freqDom.length)

      const screamScore = (zcr > 0.15 && freq > 2000) ? 0.8 : 0.1

      return { rms, screamScore, zcr, freq }
    }

    // ── Frame builder — sent every 1 second ─────────────────────────────
    const sendFrame = () => {
      const socket = ws.current
      if (!socket || socket.readyState !== WebSocket.OPEN) return

      const state                = useSafetyStore.getState()
      const { rms, screamScore, zcr, freq } = getAudioMetrics()
      const gf                   = state.gpsFeatures || {}

      // When simulation mode is active, use the store's sensorFrame audio values
      // directly so injected scenario values are not overwritten by the live mic.
      const simulationActive = state.simulationActive
      const audioData = simulationActive
        ? state.sensorFrame.audio
        : { ...state.sensorFrame.audio, rms, screamScore, zcr, freq }

      // Use peak motion from the last 1-second window (captures short impacts).
      // Reset after reading so each WebSocket frame reports its own window's peak.
      const motionData = peakMotionRef.current || state.sensorFrame.motion
      peakMotionRef.current = null

      const payload = {
        // Mode — critical: tells backend which risk formula to use
        mode: state.applicationMode,

        // GPS
        location: state.sensorFrame.location,

        // Motion — peak value in this 1s window, not just the last sample
        motion: motionData,

        // Audio (merge live mic metrics with any keyword from speech rec)
        audio: {
          ...audioData,
          audioClass: state.audioClass,
        },

        // True when SpeechRecognition started without error — even if getUserMedia
        // failed (exclusive mic lock on Windows Chrome), the mic IS online via SR.
        // Backend uses this to keep audio_quality > 0 so the audio weight is applied.
        speech_recognition_active: recognitionRef.current !== null,

        // GPS Behavioral features from gpsProcessor.js 3-layer pipeline
        gps_behavior: {
          stop_score:          gf.stop_score          ?? 0,
          deviation_score:     gf.deviation_score     ?? 0,
          confirmed_stop:      gf.confirmed_stop      ?? false,
          confirmed_deviation: gf.confirmed_deviation ?? false,
          stationary_time:     gf.stationary_time     ?? 0,
          speed_ms:            gf.speed               ?? 0,
          distance_from_route: gf.distance_from_route ?? 0,
        },

        client_hour: new Date().getHours(),
        timestamp:   Date.now(),
      }

      // Only update the store audio with live mic data when NOT in simulation mode.
      // Simulation mode preserves injected values until the scenario clears.
      if (!simulationActive) {
        setSensorFrame({ audio: { ...state.sensorFrame?.audio, rms, screamScore, zcr, freq } })
      }
      socket.send(JSON.stringify({ type: 'sensor_frame', payload }))
    }

    const sendMessage = (message) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return false
      ws.current.send(JSON.stringify(message))
      return true
    }

    // ── WebSocket connection ─────────────────────────────────────────────
    const connect = () => {
      try {
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
        // When served from FastAPI (production/ngrok), use the same host.
        // When running Vite dev server (port 3000), connect directly to FastAPI port 8000.
        const host = (window.location.port === '3000' || window.location.port === '5173')
          ? `${window.location.hostname}:8000`
          : window.location.host
        const socket   = new WebSocket(`${proto}://${host}/api/v1/ws`)
        ws.current = socket

        socket.onopen = () => {
          setWsConnected(true)
          setWsSender(sendMessage)
          // Use local `socket` — ws.current may have been reassigned by a re-render
          socket.send(JSON.stringify({ type: 'subscribe' }))
          socket.send(JSON.stringify({
            type: 'set_mode',
            mode: useSafetyStore.getState().applicationMode,
          }))

          startLocation()
          startMotion()
          startKeywordDetection()  // SR first — must claim mic before getUserMedia on Windows Chrome
          startMicrophone()        // getUserMedia after; may fail if SR holds exclusive lock (OK)

          if (!sensorTimerRef.current) {
            sensorTimerRef.current = setInterval(() => {
              if (useSafetyStore.getState().backgroundMonitoring) sendFrame()
            }, 1000)
          }
        }

        socket.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.type === 'alert_sent') {
              const smsStr   = data.sms_sent   ? '%c✓ SMS sent'   : '%c✗ SMS failed'
              const emailStr = data.email_sent ? '  %c✓ Email sent' : '  %c✗ Email failed'
              console.groupCollapsed('%c[Suraksha] 📤 ALERT DISPATCH RESULT', 'color:#f59e0b;font-weight:bold')
              console.log(smsStr,   data.sms_sent   ? 'color:#22c55e;font-weight:bold' : 'color:#ef4444;font-weight:bold')
              console.log(emailStr, data.email_sent ? 'color:#22c55e;font-weight:bold' : 'color:#ef4444;font-weight:bold')
              console.log('Time:', data.timestamp)
              console.groupEnd()
            } else if (data.type === 'route_set') {
              setRouteStatus(data)
            } else if (data.type === 'risk_update') {
              setAnalysisResult(data)
              if (data.alert_triggered) {
                const kw = useSafetyStore.getState().sensorFrame?.audio?.keyword
                const reasons = (data.reasons || []).join(' | ')
                console.warn(
                  `%c[Suraksha] 🚨 THREAT TRIGGERED`,
                  'color:#ef4444;font-weight:bold;font-size:13px'
                )
                console.table({
                  Level:    data.threat_level,
                  Score:    Math.round(data.combined_score ?? 0),
                  Keyword:  kw ? `"${kw}"` : '— none —',
                  Reasons:  reasons || '—',
                  Time:     new Date().toLocaleTimeString(),
                })
              }
              if (data.incident) addIncident(data.incident)
            }
          } catch { /* ignore parse errors */ }
        }

        socket.onclose = () => {
          setWsConnected(false)
          setWsSender(null)
          reconnectTimer = setTimeout(connect, 3000)
        }

        socket.onerror = () => {
          setWsConnected(false)
          setWsSender(null)
          socket.close()
        }
      } catch {
        setWsConnected(false)
        setWsSender(null)
      }
    }

    connect()

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (sensorTimerRef.current) {
        clearInterval(sensorTimerRef.current)
        sensorTimerRef.current = null
      }
      if (motionListenerRef.current) {
        window.removeEventListener('devicemotion', motionListenerRef.current)
        motionListenerRef.current = null
      }
      peakMotionRef.current = null
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null   // prevent restart on cleanup
          recognitionRef.current.abort()
        } catch { /* ignore */ }
        recognitionRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
      setWsSender(null)
      ws.current?.close()
    }
  }, [backgroundMonitoring])

  // Sync mode changes to backend immediately
  useEffect(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'set_mode', mode: applicationMode }))
    }
  }, [applicationMode])
}
