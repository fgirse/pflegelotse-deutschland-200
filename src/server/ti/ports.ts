import type { EvoNutzlast } from './evo'

// ── TI-Ports (§8.2, Ports & Adapters) ─────────────────────────────────────
// Die Software-Seite der Telematikinfrastruktur als austauschbare Ports. Der
// echte Transport (Konnektor/SMC-B, KIM-Fachdienst, ePA-Aktensystem) ist NICHT
// enthalten — hier stecken nur die Schnittstellen + Stubs. Ein zertifizierter
// Adapter klinkt sich später an genau diese Ports ein.

// eVerordnung eingehend (real ausgebaut).
export interface EvoEingang {
  // Nimmt eine eingehende eVO entgegen (Transport liefert die Nutzlast).
  empfange(nutzlast: EvoNutzlast): Promise<void>
}

// KIM: sichere Nachricht senden (Rückmeldung an den Arzt). Nur Port + Stub.
export interface KimNachricht {
  an: string // KIM-Adresse
  betreff: string
  text: string
}
export interface KimVersand {
  sende(nachricht: KimNachricht): Promise<void>
}

// ePA: Lesezugriff auf Patientendaten (mit Einwilligung). Nur Port + Stub.
export interface EpaLesen {
  lese(versichertennummer: string): Promise<{ verfuegbar: boolean }>
}
