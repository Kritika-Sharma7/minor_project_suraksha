/**
 * mobileUtils.js — Mobile device utility helpers
 * Provides vibration feedback patterns for safety events.
 * Uses the Web Vibration API (supported on Android; silently ignored on iOS/Desktop).
 */

// ── Vibration pattern constants ───────────────────────────────────────────────
export const VIBRATE = {
  SENSOR_ON:  [50],                      // short pulse — started
  CONFIRM:    [50, 50, 50],              // double tap — success
  SUSPICIOUS: [100, 50, 100],            // two bumps — warning
  HIGH:       [150, 50, 150, 50, 150],   // three bumps — high alert
  CRITICAL:   [500, 100, 500],           // two long — critical
}

/**
 * Trigger vibration feedback.
 * Silently no-ops on platforms that don't support the Vibration API.
 * @param {number|number[]} pattern  ms duration or [on, off, on, ...] pattern
 */
export function vibrate(pattern = [50]) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  } catch {
    // Vibration not supported — silent fail
  }
}
