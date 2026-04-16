import { useEffect, useRef } from 'react'
import { useSafetyStore } from './safetyStore'


export function useWebSocket() {
  const ws = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sensorTimerRef = useRef(null)
  const recognitionRef = useRef(null)

  const {
    setWsConnected,
    setAnalysisResult,
    setSensorEnabled,
    setSensorFrame,
    addIncident,
  } = useSafetyStore()
  const backgroundMonitoring = useSafetyStore(state => state.backgroundMonitoring)
  const applicationMode = useSafetyStore(state => state.applicationMode)

  useEffect(() => {
    let reconnectTimer

    const startLocation = () => {
      if (!navigator.geolocation) return
      navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed } = pos.coords
          setSensorEnabled('location', true)
          // Isolation proxy: low speed + low accuracy tends to happen in sparse zones.
          const isolation = Math.max(0, Math.min(1, (accuracy || 0) / 200))
          setSensorFrame({
            location: {
              lat: latitude,
              lon: longitude,
              accuracy: accuracy || 0,
              speed: speed || 0,
              isolation,
            },
          })
        },
        () => setSensorEnabled('location', false),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      )
    }

    const startMotion = () => {
      const onMotion = (event) => {
        const acc = event.accelerationIncludingGravity || event.acceleration || {}
        const rot = event.rotationRate || {}
        const ax = Number(acc.x || 0)
        const ay = Number(acc.y || 0)
        const az = Number(acc.z || 0)
        const gx = Number(rot.alpha || 0)
        const gy = Number(rot.beta || 0)
        const gz = Number(rot.gamma || 0)

        const accelMag = Math.sqrt(ax * ax + ay * ay + az * az)
        const gyroMag = Math.sqrt(gx * gx + gy * gy + gz * gz)
        const shakeScore = Math.max(0, Math.min(1, (accelMag - 9.8) / 20))
        const fallProb = Math.max(0, Math.min(1, Math.abs(accelMag - 9.8) / 12))
        const runningScore = Math.max(0, Math.min(1, accelMag / 18))

        setSensorEnabled('motion', true)
        setSensorFrame({
          motion: { accelMag, gyroMag, shakeScore, fallProb, runningScore },
        })
      }

      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        // Will fail on mount. We rely on the START SENSORS button for the explicit permission request.
        DeviceMotionEvent.requestPermission()
          .then(response => {
            if (response === "granted") console.log("Motion perm pre-granted");
          })
          .catch(() => {});
      }
      // Unconditionally attach listener so it catches data once the button grants permission.
      window.addEventListener('devicemotion', onMotion);
    }

    const startMicrophone = () => {
      const initMic = () => {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then((stream) => {
            console.log("Mic allowed");
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            audioContextRef.current = new AudioCtx();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 1024;
            source.connect(analyserRef.current);
            setSensorEnabled('microphone', true);
          })
          .catch(err => console.log(err));
      };

      initMic();
      // On iOS, auto-requesting mic on mount fails blindly. We listen for the first tap 
      // (like tapping START SENSORS) to manually bootstrap the stream if it failed.
      const fallbackMic = () => {
        if (!analyserRef.current) initMic();
        window.removeEventListener('click', fallbackMic);
        window.removeEventListener('touchstart', fallbackMic);
      };
      window.addEventListener('click', fallbackMic);
      window.addEventListener('touchstart', fallbackMic);
    }

    const startKeywordDetection = () => {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!Recognition) return

      const rec = new Recognition()
      rec.lang = 'en-US'
      rec.interimResults = true
      rec.continuous = true

      rec.onresult = (evt) => {
        const transcript = Array.from(evt.results)
          .map((r) => r[0]?.transcript || '')
          .join(' ')
          .toLowerCase()

        let keyword = ''
        let keyword_detected = false
        if (
          transcript.includes('help') ||
          transcript.includes('danger') ||
          transcript.includes('please help')
        ) {
          keyword = transcript
          keyword_detected = true
        } else if (
          transcript.includes('stop') ||
          transcript.includes('leave me') ||
          transcript.includes('save me')
        ) {
          keyword = transcript
          keyword_detected = true
        }

        if (keyword_detected) {
          setSensorFrame({ audio: { keyword, keyword_detected: true } })
          sendFrame()
        }
      }

      rec.onend = () => {
        if (backgroundMonitoring) {
          try {
            rec.start()
          } catch {}
        }
      }

      recognitionRef.current = rec
      try {
        rec.start()
      } catch {}
    }

    const getAudioMetrics = () => {
      if (!analyserRef.current) return { rms: 0, screamScore: 0, zcr: 0, freq: 0 }
      
      const bufferLength = analyserRef.current.fftSize
      const dataArray = new Uint8Array(bufferLength)
      analyserRef.current.getByteTimeDomainData(dataArray)
      
      let sum = 0
      let crossings = 0
      let lastSign = 0
      
      for (let i = 0; i < bufferLength; i++) {
        const v = (dataArray[i] - 128) / 128
        sum += v * v
        
        const sign = Math.sign(dataArray[i] - 128)
        if (lastSign !== 0 && sign !== 0 && sign !== lastSign) {
          crossings++
        }
        if (sign !== 0) lastSign = sign
      }
      
      const rms = Math.sqrt(sum / bufferLength)
      const zcr = crossings / (bufferLength - 1)
      
      const freqArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(freqArray)
      
      // Find dominant frequency
      let maxVal = -1
      let maxIndex = -1
      for (let i = 0; i < freqArray.length; i++) {
        if (freqArray[i] > maxVal) {
          maxVal = freqArray[i]
          maxIndex = i
        }
      }
      const nyquist = analyserRef.current.context.sampleRate / 2
      const freq = maxIndex * (nyquist / freqArray.length)
      
      // Scream score proxy: high ZCR + high energy in 2-4kHz band
      const screamScore = (zcr > 0.15 && freq > 2000) ? 0.8 : 0.1
      
      return { rms, screamScore, zcr, freq }
    }

    const sendFrame = () => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return
      const state = useSafetyStore.getState()
      const { rms, screamScore, zcr, freq } = getAudioMetrics()

      const payload = {
        location: state.sensorFrame.location,
        motion: state.sensorFrame.motion,
        audio: {
          ...state.sensorFrame.audio,
          rms,
          screamScore,
          zcr,
          freq,
          audioClass: state.audioClass,
        },
        timestamp: Date.now(),
      }

      setSensorFrame({ audio: { rms, screamScore, zcr, freq } })
      ws.current.send(JSON.stringify({ type: 'sensor_frame', payload }))
    }

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const hostname = window.location.hostname || 'localhost';
        const port = 8000; 
        ws.current = new WebSocket(`${protocol}://${hostname}:${port}/api/v1/ws`);

        ws.current.onopen = () => {
          console.log("WS CONNECTED");
          setWsConnected(true)
          ws.current?.send(JSON.stringify({ type: 'subscribe' }))
          ws.current?.send(JSON.stringify({ type: 'set_mode', mode: useSafetyStore.getState().applicationMode }))

          startLocation()
          startMotion()
          startMicrophone()
          startKeywordDetection()

          if (!sensorTimerRef.current) {
            sensorTimerRef.current = setInterval(() => {
              if (useSafetyStore.getState().backgroundMonitoring) {
                sendFrame()
              }
            }, 1000)
          }
        }

        ws.current.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.type === 'risk_update') {
              setAnalysisResult(data)
              if (data.incident) addIncident(data.incident)
            }
          } catch {}
        }

        ws.current.onclose = () => {
          console.log("WS CLOSED");
          setWsConnected(false)
          reconnectTimer = setTimeout(connect, 3000)
        }

        ws.current.onerror = (e) => {
          console.log("WS ERROR", e);
          setWsConnected(false)
          ws.current?.close()
        }
      } catch {
        setWsConnected(false)
      }
    }

    connect()
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (sensorTimerRef.current) clearInterval(sensorTimerRef.current)
      sensorTimerRef.current = null
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null
          recognitionRef.current.stop()
        } catch {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
      ws.current?.close()
    }
  }, [backgroundMonitoring])

  // Sync mode changes
  useEffect(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'set_mode', mode: applicationMode }))
    }
  }, [applicationMode])
}
