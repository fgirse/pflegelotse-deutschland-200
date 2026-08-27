// Ergänzt fehlende Postleitzahl und Ort in bestehenden Klienten-Adressen.
//
// Hintergrund: Vor der Umstellung auf Einzelfelder wurden Adressen als Freitext
// erfasst — im Bestand meist nur "Straße Hausnummer", ohne PLZ und Ort. Ohne
// diese Angaben ist die Geokodierung vieldeutig.
//
// Verfahren: NICHT die unvollständige Adresse geokodieren (das liefert
// Zufallstreffer über ganz Deutschland), sondern die beim Anlegen bestätigten
// KOORDINATEN aus Säule 2 rückwärts auflösen. Als Gegenprobe muss die dabei
// gefundene Straße zur gespeicherten passen — sonst wird nichts geändert.
//
// Aufruf (Trockenlauf, schreibt NICHTS):
//   CSFLE_ENABLED=false node --env-file=.env --import tsx scripts/adressen-plz-ergaenzen.ts
// Übernehmen:
//   CSFLE_ENABLED=false node --env-file=.env --import tsx scripts/adressen-plz-ergaenzen.ts --apply
//
// ACHTUNG — Verschlüsselung: Die Produktivdaten sind mit dem App-Crypto-Adapter
// verschlüsselt (CSFLE_ENABLED=false). Mit CSFLE_ENABLED=true gelesen kommt
// Binärmüll, und ein Schreiben würde die Daten unrettbar zerstören. Die
// Variable lässt sich nicht im Skript setzen (ESM lädt die Imports vorher) —
// daher die harte Prüfung unten.
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { zerlegeAdresse, baueAdresse } from '../src/shared/adresse'

const APPLY = process.argv.includes('--apply')
const BASE = process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org'
const UA = process.env.GEOCODER_USER_AGENT ?? 'PflegeLotse/1.0'

// Riegel 1: Falscher Encryptor → gar nicht erst starten.
if (process.env.CSFLE_ENABLED === 'true') {
  console.error(
    'ABBRUCH: CSFLE_ENABLED=true. Die Produktivdaten sind mit App-Crypto\n' +
      'verschlüsselt; mit CSFLE gelesen kommt Binärmüll, und ein Schreiben\n' +
      'würde die Daten zerstören. Aufruf stattdessen:\n' +
      '  CSFLE_ENABLED=false node --env-file=.env --import tsx scripts/adressen-plz-ergaenzen.ts',
  )
  process.exit(1)
}

// Riegel 2: Sieht der gelesene Wert nach Klartext aus? Ein „nicht leer"-Test
// genügt NICHT — verschlüsselte Bytes sind ebenfalls ein nicht-leerer String.
function istKlartext(s: string): boolean {
  if (!s) return false
  const lesbar = [...s].filter((c) => /[\p{L}\p{N}\p{P}\p{Zs}]/u.test(c)).length
  return lesbar / s.length >= 0.9
}

// Nominatim-Policy: höchstens eine Anfrage pro Sekunde.
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Straßennamen vergleichbar machen: "Habsburgerstr." ↔ "Habsburgerstraße".
function normStrasse(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 's')
    .replace(/stra(ss|s)e\b/g, 'str')
    .replace(/str\./g, 'str')
    .replace(/[^a-z0-9]/g, '')
}

type Rueck = { plz?: string; ort?: string; strasse?: string }

async function reverse(lat: number, lng: number): Promise<Rueck | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    addressdetails: '1',
    zoom: '18',
  })
  const res = await fetch(`${BASE}/reverse?${params}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'de' },
  })
  if (!res.ok) return null
  const d = (await res.json()) as {
    address?: {
      postcode?: string
      city?: string
      town?: string
      village?: string
      municipality?: string
      road?: string
    }
  }
  const a = d.address
  if (!a) return null
  return {
    plz: a.postcode,
    ort: a.city ?? a.town ?? a.village ?? a.municipality,
    strasse: a.road,
  }
}

async function main() {
  const payload = await getPayload({ config })

  // Koordinaten liegen in Säule 2, die Adresse in Säule 1 — verknüpft über die
  // pseudonymId. Das ist die vorgesehene Verbindung, kein PII-Abfluss.
  const op = await payload.find({
    collection: 'klienten_operativ',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const geoVon = new Map<string, { lat: number; lng: number }>()
  for (const d of op.docs as { pseudonymId?: string; geo?: { lat?: number; lng?: number } }[]) {
    if (d.pseudonymId && typeof d.geo?.lat === 'number' && typeof d.geo?.lng === 'number') {
      geoVon.set(d.pseudonymId, { lat: d.geo.lat, lng: d.geo.lng })
    }
  }

  const res = await payload.find({
    collection: 'klienten_identitaet',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const docs = res.docs as { id: string; pseudonymId?: string; adresse?: string }[]

  let vollstaendig = 0
  let ergaenzbar = 0
  let ohneKoordinaten = 0
  let strasseWeichtAb = 0
  let keinErgebnis = 0
  let leer = 0
  let geschrieben = 0

  for (const d of docs) {
    const alt = (d.adresse ?? '').trim()
    if (!alt) {
      leer++
      continue
    }
    if (!istKlartext(alt)) {
      console.error(
        '\nABBRUCH: Eine gelesene Adresse ist kein Klartext — die Entschlüsselung\n' +
          'greift nicht. Nichts wurde geändert. Umgebung prüfen (CSFLE_ENABLED,\n' +
          'ENCRYPTION_MASTER_KEY), bevor dieses Skript erneut läuft.',
      )
      process.exit(2)
    }

    const teile = zerlegeAdresse(alt)
    if (teile.plz && teile.ort) {
      vollstaendig++
      continue
    }

    const geo = d.pseudonymId ? geoVon.get(d.pseudonymId) : undefined
    if (!geo) {
      ohneKoordinaten++
      console.log('  ✗ keine Koordinaten hinterlegt — übersprungen')
      continue
    }

    const r = await reverse(geo.lat, geo.lng)
    await warte(1100)

    if (!r?.plz || !r.ort) {
      keinErgebnis++
      console.log('  ✗ Rückwärtssuche ohne PLZ/Ort — übersprungen')
      continue
    }

    // Gegenprobe: Die Straße an der Koordinate muss zur gespeicherten passen.
    // Ohne diese Prüfung würde eine falsch erfasste Koordinate stillschweigend
    // eine falsche PLZ in die Adresse schreiben.
    if (teile.strasse && r.strasse && normStrasse(teile.strasse) !== normStrasse(r.strasse)) {
      strasseWeichtAb++
      console.log(`  ~ Straße weicht ab (${r.plz} ${r.ort}) — übersprungen, bitte manuell prüfen`)
      continue
    }

    const neu = baueAdresse({ ...teile, plz: r.plz, ort: teile.ort || r.ort })
    ergaenzbar++
    console.log(`  ✓ ${r.plz} ${r.ort}`)

    if (APPLY) {
      await payload.update({
        collection: 'klienten_identitaet',
        id: d.id,
        data: { adresse: neu },
        overrideAccess: true,
      })
      geschrieben++
    }
  }

  console.log('\n── Ergebnis ──────────────────────────────')
  console.log(`  Datensätze gesamt:          ${docs.length}`)
  console.log(`  bereits vollständig:        ${vollstaendig}`)
  console.log(`  ergänzbar:                  ${ergaenzbar}`)
  console.log(`  Straße weicht ab:           ${strasseWeichtAb}`)
  console.log(`  ohne Koordinaten:           ${ohneKoordinaten}`)
  console.log(`  Rückwärtssuche erfolglos:   ${keinErgebnis}`)
  console.log(`  Adresse leer:               ${leer}`)
  console.log(
    APPLY
      ? `\n  GESCHRIEBEN: ${geschrieben}`
      : '\n  TROCKENLAUF — es wurde nichts geändert. Mit --apply übernehmen.',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
