import * as Sentry from '@sentry/nextjs'
import { commonOptions } from '@/lib/sentry-options'

// Server- und Edge-seitige Sentry-Initialisierung. Next.js ruft register()
// einmal beim Start der jeweiligen Laufzeit auf.
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' ||
    process.env.NEXT_RUNTIME === 'edge'
  ) {
    Sentry.init({ ...commonOptions })
  }
}

// Erfasst Fehler aus React Server Components / Route-Handlern (App Router).
export const onRequestError = Sentry.captureRequestError
