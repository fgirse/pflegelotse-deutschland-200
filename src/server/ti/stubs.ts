import type { KimVersand, KimNachricht, EpaLesen } from './ports'

// ── Stub-Adapter (§8.2) ───────────────────────────────────────────────────
// Dev-/Platzhalter-Implementierungen der TI-Ports. Sie protokollieren nur —
// hier klinkt später der zertifizierte Fachdienst-Client ein.

export class KimVersandStub implements KimVersand {
  async sende(nachricht: KimNachricht): Promise<void> {
    console.info(`[TI/KIM stub] an=${nachricht.an} betreff="${nachricht.betreff}"`)
  }
}

export class EpaLesenStub implements EpaLesen {
  async lese(versichertennummer: string): Promise<{ verfuegbar: boolean }> {
    console.info(`[TI/ePA stub] Leseanfrage für ${versichertennummer}`)
    return { verfuegbar: false } // ohne echtes Aktensystem nichts verfügbar
  }
}
