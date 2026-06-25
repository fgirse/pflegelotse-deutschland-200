'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Fängt Render-Fehler auf Root-Ebene (oberhalb der Route-Group-Layouts) und
// meldet sie an Sentry. Rendert ein eigenes minimales html/body, weil hier
// kein umgebendes Layout mehr greift.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="de">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div>
          <h1>Es ist ein Fehler aufgetreten.</h1>
          <p>Bitte lade die Seite neu oder versuche es später erneut.</p>
        </div>
      </body>
    </html>
  )
}
