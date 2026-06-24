# PflegeLotse — Tourenoptimierung (erster Bau)

Browserbasierte Anwendung zur Tourenoptimierung ambulanter Pflegedienste.
Dieser erste Inkrement liefert den ökonomischen Kern: das **Disponenten-Dashboard**
mit Karte, Zeitstrahl, Fit-Score und Ein-Klick-Lückenfüllung — auf einem
datenschutzkonformen 2-Säulen-Datenkern.

## Tech-Stack
Next.js (App Router) · Payload CMS 3 (MongoDB) · TypeScript strict · Tailwind v4 ·
next-intl (de/en) · zod · MapLibre GL · vitest + Playwright. Paketmanager: **pnpm**.

## Schnellstart

Die Datenbank ist **MongoDB Atlas (Cloud)**. Der Connection-String steht in `.env`
unter `DATABASE_URI` (`mongodb+srv://…`). `setup` lässt einen vorhandenen Wert
unangetastet und generiert nur fehlende Secrets.

```bash
pnpm install
pnpm run setup          # ergänzt fehlende Secrets in .env (DATABASE_URI bleibt)
pnpm run db:init        # $jsonSchema-Validatoren + Indizes (PII-Sperre Säule 2)
pnpm run db:seed        # synthetische Demodaten (Region Freiburg)
pnpm run dev            # http://localhost:3000
```

Anmeldung (Dienst-Bereich): <http://localhost:3000/de/login> — `disponent@pflegelotse.local`
/ `demo12345`, danach **2FA einrichten** (Geheimnis/otpauth-Link in eine Authenticator-App,
6-stelligen Code bestätigen). Erst dann sind Dashboard/Eingänge/Abo erreichbar.
Dashboard: <http://localhost:3000/de/dashboard> · Payload-Admin: <http://localhost:3000/admin>

Voraussetzung Atlas: Die eigene IP muss im Atlas-Projekt unter *Network Access*
freigegeben sein.

> **Lokale Alternative (optional):** Statt Atlas kann eine lokale MongoDB per Docker
> laufen — `pnpm run db:up` (Host-Port 27018) und in `.env` den `mongodb://localhost…`
> -String setzen. Nur für Offline-Entwicklung nötig.

## Architektur (Kurz)
- **2 Säulen:** `klienten_identitaet` (PII, verschlüsselt) ↔ `klienten_operativ`
  (pseudonym, nur `pseudonym_id` als UUIDv4-Verknüpfung). Ein `$jsonSchema`-Validator
  weist PII in Säule 2 serverseitig ab.
- **Encryption-Port** (`src/lib/encryption.ts`): zwei austauschbare Adapter hinter einem
  Interface. `CSFLE_ENABLED=true` → **echtes MongoDB-CSFLE** (`csfleEncryptor.ts`,
  `ClientEncryption`/libmongocrypt, explizite Verschlüsselung ohne mongocryptd/Enterprise):
  pro Klient ein Data-Encryption-Key im `__keyVault` (keyAltName = `pseudonym_id`),
  KMS `local` (Dev, 96-Byte-Key) oder `aws` (CMK); Crypto-Shredding = `deleteKey`.
  Sonst lokaler AES-256-GCM-Adapter mit pro-Klient-DEK. Beide nutzen denselben Port — die
  Collection-Hooks bleiben gleich.
- **Routing-Port** (`src/server/routing/`): aktuell Haversine-Heuristik, später OSRM/VROOM.
- **Fit-Score** (`src/server/matching/fitScore.ts`): marginale Einfügekosten unter
  Zeitfenster- und Qualifikations-Constraints, Trefferliste nach Mehrweg sortiert.
- **API v1** (`src/app/api/v1/`): zod-validiert — `clients`, `tours`, `matching/fit-score`,
  `tours/assign`, `import/clients` (CSV mit Säulen-Split).
- **Marktplatz / Reverse Bidding** (`src/server/marketplace/`): Angehörige stellen einen
  anonymen Bedarf ein (Säulen-Split: Kontakt → Säule 1 verschlüsselt, operativ → `bedarfe`
  Säule 2), Fan-out an passende Dienste über den Fit-Score, verbindliche Angebote,
  Auswahl mit **leck-sicherer Kontaktfreigabe** (`holeKontakt` gibt PII nur an den gewählten
  Dienst frei, /F340/ P6). Seiten: `/[locale]/markt` (Angehörige), `/[locale]/eingaenge` (Dienst).
- **Verbindliche 24h-Rückmeldung** (`src/server/sla/`, /F400/): beim Einstellen wird eine Frist
  gesetzt (Express kürzer) und ein E-Mail-Fan-out an passende Dienste ausgelöst
  (Notifier-Port: Console im Dev, Resend in Prod). Ein stündlicher Cron
  (`/api/v1/cron/sla`, Bearer `CRON_SECRET`, `vercel.json`) sagt abgelaufene Bedarfe ohne
  Zusage automatisch ab und benachrichtigt die Angehörige. SLA-Kennzahlen unter
  `/api/v1/sla/stats` (Rückmeldequote, Zeit bis erste Reaktion).
- **Billing / Mollie** (`src/server/billing/`, /F1000/):
  - **Express-Checkout** 19,90 € einmalig (`/api/v1/billing/{checkout,webhook,status}`, /F1020/).
  - **Vermittlungsgebühr** 49,00 €, **leck-sicher** beim Kontaktfreigabe-Ereignis
    (`waehleDienst`) erfasst (/F1040/).
  - **SaaS-Abo als Mollie-Subscription** (`subscription.ts`, /F1030/): Kunde + mandatsbildende
    Erstzahlung (`sequenceType: first`); nach Bezahlung legt der Webhook die wiederkehrende
    Subscription an; Folgeeinzüge landen als Ledger-Einträge. API: `/api/v1/billing/abo`,
    Seite `/[locale]/abo`. Tarifstufen in `billing/pricing.ts`.
  - Ledger-Collections `zahlungen` (express|gebuehr|abo) und `abos`. Der Webhook holt den
    echten Status von Mollie (vertraut nie dem Body); lokal pollt der Status-Endpoint, da
    Mollie localhost nicht erreicht.
- **KI-Pflegelotse** (`src/server/ki/`, /F600/): Dialogassistent (Anthropic Claude
  `claude-opus-4-8`, serverseitig — Key nie im Browser) zur Bedarfsstrukturierung. **Tool Use**
  (/F620/): `leistungen_nachschlagen` (Leistungskomplex-Katalog) und `bedarf_vorschlag`
  (strukturierter Entwurf, der das Bedarfsformular vorbefüllt) über eine manuelle Tool-Schleife.
  **Guardrails** (/F630/) im System-Prompt: keine medizinische/pflegefachliche Bewertung, kein
  Pflegegrad-Festlegen, Verweis auf §7a-Beratung. **Datenminimierung** (/F640/): nur Chat-Text
  an die API, niemals PII. API `POST /api/v1/ki/chat` (öffentlich), Seite `/[locale]/lotse`.
- **Kostenlose Tools** (`src/app/(frontend)/[locale]/tools/`, /F700/): öffentlich, **rein
  clientseitig, ohne PII, ohne Anmeldung**, statisch gerendert (SSG, SEO-fähig /F720/), dauerhaft
  kostenlos als Nachfrage-Funnel (/F730/). **Pflegegrad-Rechner** (`src/lib/pflegegrad.ts`,
  reine/getestete NBA-Logik: 6 Module, Gewichtung 10/15/40/20/15 %, Schwellen 12,5/27/47,5/70/90)
  — unverbindliche Orientierung mit klarem Disclaimer (Feststellung durch den Medizinischen
  Dienst). Weitere Tools (Budget-/Leistungsübersicht, Antrags-Assistent, Checklisten) als Platzhalter.
- **Präventionsmodul** (`src/server/praevention/`, /F900/, BEEP/§5 SGB XI): geführte,
  ressourcenorientierte Bedarfserhebung im §37-Abs.-3-Beratungsbesuch (/F910/). Ein
  deterministischer Generator ordnet markierte Risiken je Handlungsfeld den
  **§20-SGB-V-Angeboten** zu (/F920/, rein/getestet). Export als strukturiertes
  Markdown-Dokument für die Pflegekasse (/F930/). Optionale **KI-Formulierungshilfe** (/F940/)
  formuliert nur — die fachliche Entscheidung trifft die Pflegekraft (Status entwurf→finalisiert).
  Geschützt; Collection `praeventionsempfehlungen` (Säule 2, pseudonym). Seite `/[locale]/praevention`.
- **Auth, RBAC & 2FA** (`src/server/auth/`, `src/lib/totp.ts`, /Q110/): Passwort-Login
  (Payload) + verpflichtende **TOTP-2FA** (RFC 6238, eigene Implementierung) für Rollen mit
  Klientendatenzugriff. Der Guard `requireAuth` schützt die dienstseitige v1-API
  (401 ohne Login, 403 ohne Rolle/2FA, 200 mit gültiger 2FA-Session); `tenantId` wird aus
  dem Nutzer abgeleitet, nie aus dem Request. Dienst-Seiten (`/dashboard`, `/eingaenge`,
  `/abo`) leiten ohne gültige Sitzung auf `/login`. Öffentlich bleiben die Angehörigen-/
  externen Endpunkte (Bedarf einstellen, Angebote ansehen/wählen, Express-Checkout, Webhook).

## Tests
```bash
pnpm run typecheck
pnpm run lint
pnpm run test:unit      # vitest (Fit-Score, Encryption, PII-Sperre)
pnpm run test:e2e       # Playwright (Dashboard-Nutzerreise)
pnpm test               # beides
```

## Bewusst (noch) nicht enthalten
GoBD-Rechnungen/DATEV-Export/USt (/F1060/), Abo-Kündigung/Upgrade-UI, ERP-Adapter außer CSV,
SMS/Push (nur E-Mail), Backup-Codes/2FA-Recovery, weitere kostenlose Tools außer dem
Pflegegrad-Rechner (Budget-Übersicht, Antrags-Assistent, Checklisten — Platzhalter)
— siehe `docs/pflichtenheft-pflegelotse-tourenoptimierung.md`.

> Hinweis KI-Pflegelotse: voll implementiert und bis zur API-Grenze verifiziert (Anfrage wird
> von Anthropic akzeptiert). Eine echte Modellantwort steht aus, weil das hinterlegte
> Anthropic-Konto kein Guthaben hat („credit balance too low"); nach Aufladen funktioniert der
> Chat ohne Codeänderung.

> Hinweis CSFLE: Standardmäßig in `.env` aktiv (lokaler KMS). Für Produktion
> `CSFLE_KMS_PROVIDER=aws` + CMK setzen (Code-Pfad vorhanden, nicht getestet — kein AWS-Zugang).
> Crypto-Shredding wirkt am Speicher sofort; im selben Prozess kann libmongocrypt einen
> gelöschten Schlüssel noch bis zum Cache-Ablauf (~60 s) entschlüsseln. Wechsel des
> Adapters erfordert Re-Verschlüsselung bestehender Säule-1-Daten.

> Hinweis Abo: Die Subscription-Anlage setzt ein bezahltes Mandat voraus und läuft daher
> erst nach echtem Checkout (Webhook). Lokal verifizierbar sind Kunde + Erstzahlung.
