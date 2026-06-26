# DSGVO — Verarbeitungsverzeichnis, AVV & Lösch-/Auskunftskonzept

Interne Vorlage (Art. 30 DSGVO). Vor produktivem Start mit Datenschutz-
beauftragtem/Anwalt prüfen und Platzhalter [...] füllen.

## 1. Verantwortlicher

- Verantwortlicher: [Name/Firma, Anschrift]
- Vertreter: [Person]
- Datenschutzbeauftragter: [Name/Kontakt, falls bestellt]

## 2. Verzeichnis von Verarbeitungstätigkeiten (Art. 30)

| Tätigkeit | Betroffene | Datenkategorien | Zweck | Rechtsgrundlage | Löschfrist |
|---|---|---|---|---|---|
| Kontoverwaltung | Nutzer (Dienste, Suchende) | E-Mail, Passwort-Hash, Rolle, Dienstname, 2FA-Secret (verschl.) | Zugang/Authentifizierung | Art. 6 (1) b | mit Kontolöschung |
| Marktplatz/Vermittlung | Pflegesuchende, Angehörige | pseudonymer Bedarf (Pflegegrad, Leistungen, Zeitfenster, grobe Geo); Kontaktdaten (Säule 1, verschl.) | Vermittlung Bedarf↔Dienst | Art. 6 (1) b; Art. 9 (2) a/h | nach Abschluss/Widerruf |
| Tourenoptimierung | Klienten der Dienste | pseudonyme Operativdaten; Identität (Säule 1, verschl.) | Disposition/Touren | Art. 6 (1) b; Art. 9 (2) h | mandantengesteuert |
| Zahlungen | zahlende Dienste/Nutzer | Zahlungsstatus, Mollie-Referenzen | Abrechnung | Art. 6 (1) b, c | handels-/steuerrechtl. Fristen |
| Fehler-Tracking | Websitenutzer | Fehlerkontext (PII gefiltert) | Stabilität/Sicherheit | Art. 6 (1) f | kurz (Sentry-Retention) |
| Benachrichtigung | Dienste, Angehörige | E-Mail-Adresse, Betreff | SLA/Rückmeldung | Art. 6 (1) b, f | nach Versand |

## 3. Auftragsverarbeiter (Art. 28) — AVV abzuschließen/prüfen

| Anbieter | Zweck | Datenstandort | AVV | Drittlandgarantie |
|---|---|---|---|---|
| Vercel Inc. | Hosting/CDN | EU-Edge / US-Mutter | [ ] | SCC prüfen |
| MongoDB Atlas | Datenbank | EU-Region | [ ] | — (EU) |
| Mollie B.V. | Zahlungen | EU (NL) | [ ] | — (EU) |
| Sentry (Functional Software) | Fehler-Tracking | EU-Region wählen | [ ] | SCC prüfen |
| Resend | E-Mail-Versand | [prüfen] | [ ] | SCC prüfen |
| OpenStreetMap/Nominatim **oder** eigener Server | Geocoding | [öffentl. / eigene Instanz] | [ ] | bei eigener Instanz entfällt |
| OSRM (eigener Server) | Routing | eigener Server (EU) | n/a (eigen) | — |
| Anthropic | KI-Pflegelotse | US | [ ] | SCC + Datenminimierung (keine PII) |

Empfehlung: Geocoding und Routing produktiv über **eigene** Instanzen (EU)
betreiben, um Drittübermittlungen zu vermeiden.

## 4. Technische & organisatorische Maßnahmen (TOM, Art. 32)

- Zwei-Säulen-Trennung: Identität (Säule 1) getrennt von Operativdaten (Säule 2),
  Verknüpfung nur über zufällige UUID.
- Verschlüsselung der Säule-1-Felder (App-Crypto AES-256-GCM bzw. Atlas-CSFLE),
  pro-Datensatz-Schlüssel → Crypto-Shredding möglich.
- `$jsonSchema`-Validatoren weisen PII in Säule-2-Collections aktiv ab.
- Zugriff: rollenbasiert (RBAC), Zwei-Faktor-Pflicht für Klientendatenzugriff.
- Anti-Leakage: Kontaktfreigabe erst nach Auswahl, nur an den gewählten Dienst;
  WORM-Audit-Log der Freigaben (ohne Klarnamen).

## 5. Lösch- und Auskunftskonzept

- **Auskunft (Art. 15):** Identität über Säule 1, Operativdaten über die
  pseudonyme Kennung zusammenführen; Export auf Anfrage an [kontakt@…].
- **Löschung (Art. 17):** Crypto-Shredding — Löschen des pro-Datensatz-Schlüssels
  macht die verschlüsselten Säule-1-Felder unwiderruflich unlesbar; pseudonyme
  Restdaten ohne Personenbezug. Technischer Hebel: `KeyStore.deleteDek()` (siehe
  `src/db/keystore.ts`); Demo-Reset als Referenzimplementierung in
  `scripts/db-reset.ts`.
- **Fristen:** Routine-Löschung nach Zweckfortfall; Aufbewahrung nur bei
  gesetzlicher Pflicht (z. B. Rechnungen).
- **Prozess:** Eingang über [kontakt@…] → Identitätsprüfung → Bearbeitung binnen
  eines Monats (Art. 12 Abs. 3).

## 6. Offene Punkte vor Go-Live

- [ ] Art.-9-Rechtsgrundlage final festlegen (Einwilligung vs. § 22 BDSG / Art. 9 (2) h).
- [ ] Einwilligungstext + Nachweis (Opt-in) im Bedarfs-/Registrierungsfluss.
- [ ] Alle AVV abschließen; Drittland-SCC dokumentieren.
- [ ] Impressum/Datenschutzerklärung mit echten Daten füllen und prüfen lassen.
- [ ] Aufsichtsbehörde benennen.
