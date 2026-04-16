import { useEffect } from 'react'
import { useSafetyStore } from './safetyStore'

export function useCountdown() {
  const { alertCountdown, tickCountdown } = useSafetyStore()

  useEffect(() => {
    if (alertCountdown <= 0) return
    const id = setInterval(tickCountdown, 1000)
    return () => clearInterval(id)
  }, [alertCountdown > 0])

  return alertCountdown
}
