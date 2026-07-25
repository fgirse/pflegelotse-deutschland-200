// Offline-Warteschlange der mobilen Erfassung (§5.3). Reine Logik — die
// Persistenz (IndexedDB) und das Senden (fetch) werden injiziert, damit sie
// unabhängig testbar ist.

export type ErfassungEventTyp = 'ankunft' | 'erledigt' | 'abweichung'

export interface ErfassungAktion {
  aktionId: string // client-generierte UUID → idempotentes Nachspielen
  tourId: string
  pseudonymId: string
  event: ErfassungEventTyp
  zeit?: number // Gerätezeit (Min seit Mitternacht)
  grund?: string // bei 'abweichung'
}

// Fügt eine Aktion hinzu, wenn ihre aktionId noch nicht in der Queue ist
// (idempotent gegen Doppelklicks).
export function enqueue(queue: ErfassungAktion[], aktion: ErfassungAktion): ErfassungAktion[] {
  if (queue.some((a) => a.aktionId === aktion.aktionId)) return queue
  return [...queue, aktion]
}

// Spielt die Queue der Reihe nach ab; erfolgreich gesendete werden entfernt,
// fehlgeschlagene bleiben erhalten (Retry beim nächsten Flush). `senden` gibt
// true zurück, wenn der Server die Aktion angenommen (oder dedupliziert) hat.
export async function flushQueue(
  queue: ErfassungAktion[],
  senden: (a: ErfassungAktion) => Promise<boolean>,
): Promise<{ verbleibend: ErfassungAktion[]; gesendet: number }> {
  const verbleibend: ErfassungAktion[] = []
  let gesendet = 0
  for (const a of queue) {
    let ok = false
    try {
      ok = await senden(a)
    } catch {
      ok = false
    }
    if (ok) gesendet++
    else verbleibend.push(a)
  }
  return { verbleibend, gesendet }
}
