import * as Sentry from '@sentry/nextjs'
import { commonOptions } from '@/lib/sentry-options'

// Client-seitige Sentry-Initialisierung (Browser). Session Replay ist bewusst
// NICHT eingebunden — es würde DOM-Inhalte und Eingaben erfassen (PII-Risiko).
Sentry.init({ ...commonOptions })

// Instrumentiert clientseitige Navigationen des App Routers.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
