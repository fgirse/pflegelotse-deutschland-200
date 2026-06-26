import { setRequestLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

// Datenschutzerklärung (DSGVO). VORLAGE, zugeschnitten auf den tatsächlichen
// Datenfluss von PflegeLotse — vor Veröffentlichung anwaltlich/datenschutz-
// rechtlich prüfen lassen (insbesondere Art.-9-Rechtsgrundlage).
export default async function DatenschutzPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container-page max-w-2xl py-10 sm:py-14">
      <span className="eyebrow">Rechtliches</span>
      <h1 className="mt-2 text-3xl font-bold">Datenschutzerklärung</h1>

      <div className="card mt-4 border-l-4 border-l-[var(--color-accent)] p-4 text-sm text-[var(--color-muted)]">
        Hinweis: Vorlage, zugeschnitten auf die Datenverarbeitung dieser Anwendung.
        Platzhalter <code>[…]</code> ausfüllen und vor Veröffentlichung rechtlich
        prüfen lassen — besonders die Rechtsgrundlage für Gesundheitsdaten (Art. 9
        DSGVO).
      </div>

      <div className="mt-6 flex flex-col gap-6 leading-relaxed text-[var(--color-muted)]">
        <section>
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
            1. Verantwortlicher
          </h2>
          <p className="mt-2">
            [Name/Firma], [Anschrift], E-Mail: [kontakt@deine-domain.de]. Einen
            Datenschutzbeauftragten erreichst du unter [datenschutz@deine-domain.de] (sofern
            bestellt).
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
            2. Grundprinzip: Trennung &amp; Pseudonymisierung
          </h2>
          <p className="mt-2">
            Identifizierende Daten (Name, Adresse, Kontakt) werden getrennt von den operativen
            Daten gespeichert (Zwei-Säulen-Modell). Operative Daten (z. B. Pflegebedarf, grobe
            Lage, Zeitfenster) sind nur über eine zufällige Kennung verknüpft und enthalten
            selbst keine Klarnamen. Identifizierende Felder werden verschlüsselt gespeichert;
            durch Löschen des zugehörigen Schlüssels werden sie unwiderruflich unlesbar
            („Crypto-Shredding“).
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
            3. Verarbeitete Daten, Zwecke und Rechtsgrundlagen
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Konto-/Anmeldedaten</strong> (E-Mail, Passwort-Hash, Rolle, ggf.
              Dienstname): zur Bereitstellung des Zugangs. Rechtsgrundlage: Art. 6 Abs. 1 lit. b
              DSGVO (Vertrag).
            </li>
            <li>
              <strong>Pflegebedarf &amp; Vermittlung</strong> (pseudonyme Bedarfsdaten,
              Kontaktdaten der Suchenden): zur Vermittlung zwischen Suchenden und Pflegediensten.
              Kontaktdaten werden erst nach Auswahl eines Dienstes an genau diesen freigegeben.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
            </li>
            <li>
              <strong>Gesundheitsbezogene Angaben</strong> (z. B. Pflegegrad, Pflegebedarf): als
              Daten besonderer Kategorien nach Art. 9 DSGVO. Rechtsgrundlage: Einwilligung nach
              Art. 9 Abs. 2 lit. a DSGVO [und/oder Art. 9 Abs. 2 lit. h zur Gesundheitsvorsorge —
              rechtlich prüfen und konkretisieren].
            </li>
            <li>
              <strong>Standort/Geocoding</strong> (Ort/Adresse → grobe Koordinaten, auf ~100 m
              gerundet): zur Zuordnung passender Dienste. Rechtsgrundlage: Art. 6 Abs. 1 lit. b/f
              DSGVO.
            </li>
            <li>
              <strong>Server-/Sitzungsdaten</strong> (technisch notwendige Cookies, Protokolle):
              zum sicheren Betrieb. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
            4. Cookies
          </h2>
          <p className="mt-2">
            Es werden ausschließlich technisch notwendige Cookies gesetzt: ein Anmelde-Cookie
            (<code>payload-token</code>) und ein Cookie zur Bestätigung der
            Zwei-Faktor-Anmeldung (<code>pl_2fa</code>). Diese sind für den Betrieb erforderlich
            und bedürfen keiner Einwilligung. Es werden keine Marketing- oder Tracking-Cookies
            gesetzt.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
            5. Empfänger / Auftragsverarbeiter
          </h2>
          <p className="mt-2">
            Wir setzen sorgfältig ausgewählte Dienstleister als Auftragsverarbeiter (Art. 28
            DSGVO) ein. Mit allen bestehen Auftragsverarbeitungsverträge:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Vercel Inc.</strong> — Hosting/Auslieferung der Anwendung.
            </li>
            <li>
              <strong>MongoDB Atlas</strong> — Datenbank (EU-Region).
            </li>
            <li>
              <strong>Mollie B.V.</strong> — Zahlungsabwicklung (nur bei Zahlungen).
            </li>
            <li>
              <strong>Sentry</strong> — Fehler-Tracking (EU-Region; PII werden vor dem Versand
              herausgefiltert), sofern aktiviert.
            </li>
            <li>
              <strong>Resend</strong> — Versand von Benachrichtigungs-E-Mails, sofern aktiviert.
            </li>
            <li>
              <strong>OpenStreetMap / Nominatim</strong> bzw. eigener Geocoding-Server — Umwandlung
              von Ortsangaben in Koordinaten.
            </li>
            <li>
              <strong>Routing-Server (OSRM)</strong> — Berechnung von Fahrzeiten (eigene oder
              beauftragte Instanz).
            </li>
            <li>
              <strong>Anthropic</strong> — KI-gestützte Bedarfsbeschreibung („KI-Pflegelotse“);
              es werden bewusst keine personenbezogenen Daten übermittelt (Datenminimierung).
            </li>
          </ul>
          <p className="mt-2">
            Bei Übermittlungen in Drittländer bestehen geeignete Garantien (z. B. EU-Standard-
            vertragsklauseln). [Konkrete Anbieter, Standorte und Garantien rechtlich prüfen.]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
            6. Speicherdauer &amp; Löschung
          </h2>
          <p className="mt-2">
            Daten werden gelöscht, sobald sie für die genannten Zwecke nicht mehr erforderlich
            sind oder du die Löschung verlangst, soweit keine gesetzlichen Aufbewahrungspflichten
            entgegenstehen. Identifizierende Daten können per Crypto-Shredding unwiderruflich
            unlesbar gemacht werden.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
            7. Deine Rechte
          </h2>
          <p className="mt-2">
            Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
            Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und
            Widerspruch (Art. 21). Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für
            die Zukunft widerrufen. Wende dich dazu an [kontakt@deine-domain.de]. Außerdem hast du
            ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde (z. B. [zuständige
            Landesbehörde]).
          </p>
        </section>

        <p className="text-xs text-[var(--color-faint)]">Stand: [Datum]. Version: Vorlage 1.0.</p>
      </div>
    </main>
  )
}
