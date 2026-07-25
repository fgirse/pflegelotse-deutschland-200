'use client'

import { useEffect } from 'react'

// Registriert den Service Worker (§5.3 PWA/Offline). Fehlschläge werden
// stillschweigend ignoriert — die Seite bleibt online voll funktionsfähig.
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
