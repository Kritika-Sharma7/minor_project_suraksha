import { useEffect, useRef } from 'react'
import { useSafetyStore } from '../store/safetyStore'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/v1/ws/threat-stream'

export function useWebSocket() {
  const ws = useRef(null)
  const { setWsConnected } = useSafetyStore()

  useEffect(() => {
    const connect = () => {
      try {
        ws.current = new WebSocket(WS_URL)

        ws.current.onopen = () => {
          setWsConnected(true)
          console.log('WS connected')
        }

        ws.current.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.type === 'ping') return
            // Additional real-time events can be handled here
          } catch {}
        }

        ws.current.onclose = () => {
          setWsConnected(false)
          // Reconnect after 3s
          setTimeout(connect, 3000)
        }

        ws.current.onerror = () => {
          setWsConnected(false)
          ws.current?.close()
        }
      } catch {
        setWsConnected(false)
      }
    }

    connect()
    return () => {
      ws.current?.close()
    }
  }, [])
}
