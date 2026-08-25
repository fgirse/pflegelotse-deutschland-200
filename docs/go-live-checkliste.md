# Go-Live-Checkliste (Pilot)

Stand der Produktivhärtung. Punkte mit ⚙️ erledigst du im Vercel-Dashboard
bzw. in den Env-Variablen, Punkte mit ▶️ per Befehl auf deinem Rechner.

## Sicherheit / Zugänge

- [ ] ▶️ **Demo-Zugang entfernen.** Der Seed-Account `disponent@pflegelotse.local`
      (Passwort `demo12345`) darf in Produktion nicht bleiben. Eigenen Admin
      anlegen und Demo löschen:
      `ADMIN_EMAIL=du@example.de pnpm run admin:create`
- [ ] ⚙️ **Starke Admin-Passwörter** für alle Betreiber-/Inhaber-Konten.
- [ ] ⚙️ Prüfen, dass `PAYLOAD_SECRET`, `ENCRYPTION_MASTER_KEY`, `AUDIT_PEPPER`
      in Vercel echte, lange Zufallswerte sind (nicht die `.env.example`-Platzhalter).

## Verschlüsselung

- [ ] ⚙️ `ENCRYPTION_MASTER_KEY` in Vercel **identisch** zum lokalen `.env`-Wert,
      mit dem die Daten verschlüsselt wurden — sonst sind Säule-1-Daten nicht
      lesbar.
- [ ] ▶️ Verifizieren: `pnpm run check:encryption` (liest eine Klienten-Identität
      und meldet, ob der Schlüssel passt).
- [ ] CSFLE: in Produktion bewusst `CSFLE_ENABLED=false` (App-Crypto), da
      Vercel-Serverless kein mongocrypt hosten kann. Echtes Atlas-CSFLE braucht
      eine andere Laufzeit (Container) — separates Thema.

## Monitoring / Fehler-Tracking

- [ ] ⚙️ **Sentry**: Projekt (EU-Region) anlegen und `NEXT_PUBLIC_SENTRY_DSN`
      in Vercel setzen. Ohne DSN ist Sentry inaktiv. Optional `SENTRY_ORG`,
      `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` für Source-Maps.
- [ ] ⚙️ **Vercel Analytics** und **Speed Insights** im Projekt-Dashboard
      einschalten (Tabs „Analytics" / „Speed Insights").
- [ ] **Uptime-Check** auf `GET /api/v1/health` einrichten (liefert 200/503).
      Der Body enthält zusätzlich `routing.modus` — einen zweiten Check darauf
      setzen, damit ein Ausfall des Routing-Servers auffällt (er führt nicht zu
      503, die App plant ja weiter, nur mit Luftlinie).

## Payment

- [ ] ⚙️ Mollie von **Test-** auf **Live-Key** umstellen (`MOLLIE_API_KEY`),
      Webhook-URL in Mollie auf die Produktions-Domain zeigen lassen.
- [ ] Einen echten Checkout end-to-end testen (kleiner Betrag).

## Recht / DSGVO (separater Block, vor echtem Publikumsstart)

- [ ] Datenschutzerklärung, Impressum.
- [ ] AVV mit Auftragsverarbeitern: Mollie, Sentry, Resend, MongoDB Atlas, Vercel.
- [ ] Verzeichnis von Verarbeitungstätigkeiten; Lösch-/Auskunftskonzept.

## Routing

Ohne Straßenrouting rechnet die Planung mit Luftlinie — das Kernversprechen
(„passgenaue Zusatzmarge auf die real gefahrene Route") ist dann nicht
belastbar. **Schritt-für-Schritt-Anleitung: `infra/osrm/README.md`**
(Compose-Dateien, `prepare.sh` und Caddy-Proxy liegen fertig daneben).

- [ ] ▶️ Eigenen OSRM-Server aufsetzen: VPS bei einem EU-Hoster,
      `pnpm run osrm:prepare` (Graph bauen), `pnpm run osrm:up:prod`
      (Caddy + TLS + API-Key). Entscheidung gegen HERE: Klientenkoordinaten sind
      faktisch Wohnadressen Pflegebedürftiger und sollen die eigene
      Infrastruktur nicht verlassen.
- [ ] ⚙️ In Vercel verdrahten: `ROUTING_PROVIDER=osrm`, `OSRM_BASE_URL`,
      `OSRM_API_KEY` (Production **und** Preview), danach neu deployen.
- [ ] ▶️ Verifizieren: `GET /api/v1/health` meldet `"routing":{"modus":"strasse"}`.
      Steht dort `luftlinie`, nennt das Feld `grund` die Ursache. Im
      Luftlinien-Modus zeigen Tourenplanung und Berichte zusätzlich ein Banner.
- [ ] AVV mit dem OSRM-Hoster abschließen, Proxy-Access-Logs mit kurzer
      Löschfrist (die URLs enthalten Koordinaten).
- [ ] Monatlichen Karten-Refresh als Cron einrichten (Anleitung, Abschnitt
      „Betrieb").

Bei Ausfall greift automatisch der Haversine-Fallback — er wird ins Log und an
Sentry gemeldet, statt still zu bleiben.
