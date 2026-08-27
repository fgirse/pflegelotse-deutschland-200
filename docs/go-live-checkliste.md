# Go-Live-Checkliste (Pilot)

Stand der Produktivhärtung. Punkte mit ⚙️ erledigst du im Vercel-Dashboard
bzw. in den Env-Variablen, Punkte mit ▶️ per Befehl auf deinem Rechner.

## Sicherheit / Zugänge

- [x] ▶️ **Demo-Zugang entfernt** (2026-08-25). Der Seed-Account
      `disponent@pflegelotse.local` (Passwort `demo12345`) ist aus der
      Produktivdatenbank gelöscht. Betreiber-Zugang bleibt
      `admin@pflegelotse-deutschland.de` (plattform_admin).
      **Achtung:** `pnpm run db:seed` legt den Demo-Zugang wieder an — nie gegen
      die produktive `DATABASE_URI` laufen lassen. Falls doch nötig, danach
      erneut löschen. Neuen Betreiber-Admin anlegen geht mit
      `ADMIN_EMAIL=du@example.de pnpm run admin:create` (entfernt den Demo-Zugang
      gleich mit).
- [x] ▶️ **E2E-Tests von der Produktivdatenbank getrennt** (2026-08-25). Sie
      liefen bisher über `.env` gegen dasselbe Atlas-Cluster wie die Produktion,
      schreiben aber Daten und setzen bei jedem Lauf das 2FA-Geheimnis des
      Testkontos zurück. Jetzt: eigene lokale Wegwerf-DB über `.env.test`,
      Testserver auf Port 3001, und `playwright.config.ts` bricht ab, wenn
      `DATABASE_URI` nicht auf `localhost` zeigt. Ablauf im README, Abschnitt
      „Tests".
- [ ] **Preview-Deployments von der Produktivdatenbank trennen.** `DATABASE_URI`
      ist in Vercel für „Production, Preview" gesetzt — jeder Branch-Deploy
      schreibt damit in die Live-Datenbank mit echten Mandanten. Bisher folgenlos
      (es gab noch nie ein Preview-Deployment), aber eine Falle beim ersten
      Feature-Branch. Stand 2026-08-26:
      - [x] Datenbank `pflege_preview` angelegt, initialisiert (Validatoren +
            Indizes) und mit Demodaten geseedet — mit **eigenen** Secrets, damit
            ein Preview-Deployment Produktionsdaten selbst bei Zugriff nicht
            entschlüsseln könnte. Werte in `~/pflegelotse-preview.env`.
      - [ ] ⚙️ Atlas-Nutzer anlegen, der **nur** auf `pflege_preview`
            readWrite+dbAdmin hat (ein anderer Datenbankname allein ist kein
            Zugriffsschutz — die heutigen Zugangsdaten kämen weiterhin an
            `pflege_dev`).
      - [ ] ⚙️ In Vercel bei `DATABASE_URI` den Haken „Preview" entfernen
            (Production unangetastet lassen) und eine neue `DATABASE_URI` nur
            für Preview anlegen; dazu `PAYLOAD_SECRET`,
            `ENCRYPTION_MASTER_KEY`, `AUDIT_PEPPER`, `AUDIT_PEPPER_VERSION`,
            `CRON_SECRET` für Preview überschreiben.
      - Vercel Authentication ist aktiv (Deployment-URLs leiten auf SSO), der
        Demo-Zugang in `pflege_preview` ist daher unkritisch.
- [ ] ⚙️ **Starke Admin-Passwörter** für alle Betreiber-/Inhaber-Konten.
- [~] ⚙️ `PAYLOAD_SECRET`, `ENCRYPTION_MASTER_KEY`, `AUDIT_PEPPER` in Vercel:
      **nicht direkt prüfbar** — sie sind als „Sensitive" angelegt, und solche
      Werte gibt Vercel nicht mehr heraus (auch nicht im Dashboard, dort lassen
      sie sich nur überschreiben). Indirekt belegt: Die lokalen Gegenstücke sind
      44–64 Zeichen lang und entsprechen keinem `.env.example`-Platzhalter, der
      Schlüssel entschlüsselt die Produktivdaten, und die Produktion läuft seit
      über zwei Monaten mit echten Mandanten. Wer letzte Sicherheit will, setzt
      die Werte einmal neu — Vorsicht: `ENCRYPTION_MASTER_KEY` darf dabei NICHT
      geändert werden, sonst sind alle Säule-1-Daten unlesbar.

## Verschlüsselung

- [x] ⚙️ `ENCRYPTION_MASTER_KEY` in Vercel passt zu den gespeicherten Daten
      (verifiziert 2026-08-27). Sonst wären Säule-1-Daten nicht lesbar.
- [x] ▶️ Lokal verifiziert: `pnpm run check:encryption` meldet OK.
      Die lokale `.env` stand bis 2026-08-27 auf `CSFLE_ENABLED=true`, während
      die Produktivdaten mit App-Crypto geschrieben sind — lokale Skripte lasen
      damit Binärmüll, und ein Schreiben hätte die Daten zerstört. Lokal steht
      jetzt ebenfalls `false`, Entwicklung und Produktion nutzen also dasselbe
      Verfahren. Die Prüfwerkzeuge erkennen unentschlüsselte Werte seitdem
      zuverlässig (vorher meldeten sie fälschlich OK).
- [x] Für die **Produktion** prüft das der Health-Check dauerhaft und ohne
      Login: `GET /api/v1/health` meldet `"krypto":"ok"` (bestätigt). Der Test
      prüft seit 2026-08-27 echten Klartext — vorher nur „String nicht leer",
      was auch ein unentschlüsselter Wert erfüllt hätte.
      `"schluesselFehler"` hieße, dass `ENCRYPTION_MASTER_KEY` in Vercel nicht
      zu den gespeicherten Daten passt — die App liefe dann weiter und zeigte
      nur keine Namen mehr. `"keineDaten"` heißt lediglich, dass noch keine
      Identität angelegt ist.
- [x] CSFLE: in Produktion bewusst `CSFLE_ENABLED=false` (App-Crypto), da
      Vercel-Serverless kein mongocrypt hosten kann. Bestätigt 2026-08-27 —
      die Produktivdaten sind mit App-Crypto geschrieben. Echtes Atlas-CSFLE
      bräuchte eine andere Laufzeit (Container) und ist ein eigenes Thema, kein
      offener Punkt dieser Liste.

## Monitoring / Fehler-Tracking

- [x] ⚙️ **Sentry aktiv** (2026-08-26). Projekt in der **EU-Region** angelegt
      (DSN auf `ingest.de.sentry.io` — die Region wird einmalig beim Anlegen der
      Organisation gewählt und ist nachträglich nicht änderbar).
      `NEXT_PUBLIC_SENTRY_DSN` ist in Vercel für Production und Preview gesetzt,
      als Typ „Config" (nicht sensitiv): Der DSN muss im Browser-Bundle stehen,
      damit clientseitige Fehler gemeldet werden, und er erlaubt nur das
      Einsenden von Events, kein Lesen. Übertragung mit einem Testereignis
      verifiziert.
      Damit sind auch die Degradierungs-Meldungen scharf, die vorher ins Leere
      liefen: Routing-Ausfall und `krypto`-Schlüsselfehler.
      Die lokale `.env` bleibt bewusst **ohne** DSN — sonst landet jeder
      Entwicklungsfehler im selben Projekt.
- [x] ⚙️ **Source-Map-Upload aktiv** (2026-08-27). `SENTRY_AUTH_TOKEN`
      (Organization Token, als Secret), `SENTRY_ORG=pflegelotse-deutschland` und
      `SENTRY_PROJECT` in Vercel für Production und Preview gesetzt. Der Build
      lädt die Maps hoch und löscht sie danach aus dem Deployment
      (`deleteSourcemapsAfterUpload`), sodass der Client-Quelltext nicht
      öffentlich abrufbar bleibt.
      - `SENTRY_PROJECT` trägt die **Projekt-ID** aus dem DSN, nicht den Slug:
        Sentry akzeptiert beides, und die ID bleibt stabil, wenn das Projekt
        umbenannt wird.
      - Organization Tokens haben eng gefasste CI-Rechte — sie können Releases
        anlegen, aber weder Projekte auflisten noch Releases löschen. Ein
        403 auf solche Aufrufe ist erwartetes Verhalten, kein Fehler.
      - Die Region steckt im Token selbst (`de.sentry.io`); `SENTRY_URL` muss
        nirgends gesetzt werden.
- [ ] ⚙️ Nach dem ersten Deployment prüfen, ob der SLA-Cron als Sentry Cron
      Monitor erscheint (`automaticVercelMonitors`).
- [ ] ⚙️ **Vercel Analytics** und **Speed Insights** im Projekt-Dashboard
      einschalten (Tabs „Analytics" / „Speed Insights").
- [ ] **Uptime-Check** auf `GET /api/v1/health` einrichten. Der Statuscode
      spiegelt nur die Datenbank (200/503). Der Body fasst unter `status`
      zusammen: `ok` | `degraded` | `error` — ein Check auf
      `status == "ok"` deckt damit alles ab. `degraded` bedeutet: die App läuft,
      ist aber fachlich beeinträchtigt (Routing-Server weg → Luftlinien-
      Fahrzeiten, oder `ENCRYPTION_MASTER_KEY` passt nicht → keine Namen).
      Details stehen in `routing.modus`/`routing.grund` und `krypto`.

## Payment

- [ ] ⚙️ Mollie von **Test-** auf **Live-Key** umstellen (`MOLLIE_API_KEY`),
      Webhook-URL in Mollie auf die Produktions-Domain zeigen lassen.
- [ ] Einen echten Checkout end-to-end testen (kleiner Betrag).

## Datenschutz-Invariante (Säule 2)

- [x] **PII-Sperre auf allen Säule-2-Collections** (2026-08-26). Vorher trugen
      nur 4 Collections einen `$jsonSchema`-Validator (`klienten_operativ`,
      `bedarfe`, `pflegekraft_stamm`, `abwesenheiten`); `touren`, `stammtouren`,
      `leistungsnachweise`, `verordnungen`, `praeventionsempfehlungen`,
      `angebote`, `abos`, `zahlungen`, `klienten_keys` und `gdpr_audit_log`
      waren ungeschützt — obwohl CLAUDE.md die Sperre für alle zusichert.
      Jetzt 14 Collections, in `pflege_dev` **und** `pflege_preview` angewendet.
      - Bei `touren`/`stammtouren` reicht die Sperre in `einsaetze[]` hinein;
        ohne das wäre sie über ein verschachteltes Feld umgehbar gewesen.
      - Gesperrt sind: vorname, nachname, geburtsdatum, adresse, telefon,
        email, kvnr, versichertennummer (zentrale Liste in
        `src/db/validators.ts`, gilt für alle Collections gleich).
      - Bewusst **ohne** Validator: `klienten_identitaet` und
        `angehoerige_identitaet` (Säule 1 — dort gehört PII hin), `users`
        (Auth) sowie `leistungskatalog` und `abrechnungskonfiguration`
        (Mandanten-Stammdaten; deren DATEV-Kopfdaten dürfen legitim eine
        Firmenanschrift enthalten).
- [ ] Nach jeder neuen Säule-2-Collection `pnpm run db:init` laufen lassen und
      die Collection in `BLACKBOX_COLLECTIONS` eintragen — sonst entsteht
      wieder eine ungeschützte Flanke.

## Recht / DSGVO (separater Block, vor echtem Publikumsstart)

- [~] **Impressum und Datenschutzerklärung** (2026-08-27). Betreiberangaben
      eingetragen: Pflegelotse Deutschland GmbH, Staufener Straße 79,
      79189 Bad Krozingen, Geschäftsführer Michael Schreck,
      `info@pflegelotse-deutschland.gmx.de`. In der Datenschutzerklärung
      zusätzlich der Verantwortliche, die zuständige Aufsichtsbehörde (LfDI
      Baden-Württemberg, Sitz des Verantwortlichen) und der Stand.
      **Noch offen — ohne diese Angaben ist das Impressum unvollständig:**
      - [ ] ⚙️ Registergericht (Amtsgericht) und HRB-Nummer. Für eine GmbH
            Pflichtangabe nach § 5 Abs. 1 Nr. 4 DDG. Bis dahin steht ein
            sichtbarer Hinweis auf der Seite.
      - [ ] ⚙️ Umsatzsteuer-Identifikationsnummer (§ 27a UStG), falls
            vorhanden — die `DE`-Nummer, nicht die Steuernummer. Die Zeile ist
            derzeit ausgelassen.
      - [ ] Beide Texte anwaltlich prüfen lassen, besonders die Rechtsgrundlage
            für Gesundheitsdaten (Art. 9 DSGVO).
- [ ] AVV mit Auftragsverarbeitern: Mollie, Sentry, Resend, MongoDB Atlas, Vercel,
      OSRM-Hoster. Bei **Sentry** liegen die Daten in der EU-Region (Frankfurt);
      das DPA gibt es online im Sentry-Konto. Das PII-Scrubbing in
      `src/lib/sentry-options.ts` entfernt Request-Bodies, Cookies, Auth-Header,
      Query-Strings und die Nutzeridentität vor dem Versand — Session Replay ist
      bewusst nicht aktiv.
- [ ] Verzeichnis von Verarbeitungstätigkeiten; Lösch-/Auskunftskonzept.

## Routing

Ohne Straßenrouting rechnet die Planung mit Luftlinie — das Kernversprechen
(„passgenaue Zusatzmarge auf die real gefahrene Route") ist dann nicht
belastbar. **Schritt-für-Schritt-Anleitung: `infra/osrm/README.md`**
(Compose-Dateien, `prepare.sh` und Caddy-Proxy liegen fertig daneben).

- [x] ▶️ Eigener OSRM-Server läuft. Entscheidung gegen HERE: Klientenkoordinaten
      sind faktisch Wohnadressen Pflegebedürftiger und sollen die eigene
      Infrastruktur nicht verlassen.
- [x] ⚙️ In Vercel verdrahtet: `ROUTING_PROVIDER`, `OSRM_BASE_URL`,
      `OSRM_API_KEY` für Production **und** Preview gesetzt.
- [x] ▶️ Verifiziert (2026-08-27): `GET /api/v1/health` meldet
      `"routing":{"modus":"strasse"}`. Steht dort `luftlinie`, nennt das Feld
      `grund` die Ursache; dann zeigen Tourenplanung und Berichte zusätzlich ein
      Banner.
- [ ] AVV mit dem OSRM-Hoster abschließen, Proxy-Access-Logs mit kurzer
      Löschfrist (die URLs enthalten Koordinaten).
- [ ] Monatlichen Karten-Refresh als Cron einrichten (Anleitung, Abschnitt
      „Betrieb").

Bei Ausfall greift automatisch der Haversine-Fallback — er wird ins Log und an
Sentry gemeldet, statt still zu bleiben.
