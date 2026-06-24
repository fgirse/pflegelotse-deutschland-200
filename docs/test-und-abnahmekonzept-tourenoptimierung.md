# Test- und Abnahmekonzept

Tourenoptimierungs- und Vermittlungsplattform (ambulante Pflege). Legt fest, *wie* getestet
und *wann* abgenommen wird. Drei Leitlinien prägen das Konzept:

- **Solo-tauglich (P7):** Was prüfbar ist, läuft automatisiert in der CI; manuelle Prüfungen
  sind selten, gebündelt und gezielt.
- **Art-9-Kritikalität:** Da Gesundheitsdaten verarbeitet werden, sind Datenschutz- und
  Sicherheitstests kein Anhang, sondern ein Schwerpunkt mit eigenem Abnahme-Gate.
- **Validierung vor Code (P8):** Die Pilotphase mit echten Diensten ist Teil der Abnahme,
  nicht nur des Marketings.

---

## 1. Teststufen

### 1.1 Grundsätze und Testdaten

Die Teststrategie folgt der Testpyramide: viele schnelle Unit-Tests, weniger Integrationstests,
wenige E2E-Tests. Alles Automatisierbare ist Bestandteil der CI (GitHub Actions) und blockiert
bei Rotphase den Merge.

**Testdaten — harte Regel:** In Test-, CI- und Staging-Umgebungen werden **ausschließlich
synthetische oder vollständig anonymisierte Daten** verwendet, niemals echte Klientendaten
(DSGVO). Ein Generator erzeugt realistische, aber fiktive Klienten, Touren und Bedarfe.

**Umgebungen:** Dev → CI → Staging (synthetische Daten) → Produktion. Stripe im Test-Modus,
Anthropic-API gemockt bzw. mit Eval-Sandbox, OSRM/VROOM mit kleinem OSM-Extrakt der Pilotregion.

### 1.2 Teststufen im Überblick

| Stufe | Fokus | Werkzeuge (Festlegung) | Ausführung |
|---|---|---|---|
| Unit | Domänenlogik: Fit-Score-Berechnung, Tarif-/Abrechnungsregeln, Validierung, Adapter-Mapper, ETL-Säulen-Split | Jest | jeder Commit (CI) |
| Integration | Modul ↔ MongoDB (2-Säulen), ↔ OSRM/VROOM, ↔ Stripe (Test), ↔ Nominatim, Adapter gegen Beispiel-Exporte | Jest + Testcontainers (Mongo/Redis) | jeder Push (CI) |
| API / Kontrakt | REST-Endpunkte gegen OpenAPI, Tenant-Scoping, RBAC-Guards, Fehlerformat, Adapter-Ports | supertest, Pact | jeder Push (CI) |
| System / E2E | Vollständige Nutzerreisen über die UI (s. 2.2) | Playwright | nightly + vor Release |
| Performance / Last | Fit-Score < 1 s, Optimierung unter Last, Cache-Verhalten | k6 | vor Release + bei Engine-Änderung |
| Barrierefreiheit | WCAG 2.1 AA, Karten-Textalternative | axe-core, Lighthouse + manuell (NVDA) | CI (automatisch) + periodisch (manuell) |
| Lokalisierung / Kompatibilität | i18n-Vollständigkeit, RTL, Cross-Device/Browser | i18n-Linter, BrowserStack | vor Release |

Die folgenden drei Bereiche sind in diesem Projekt überdurchschnittlich kritisch und daher
gesondert ausgeführt.

### 1.3 Schwerpunkt Sicherheit und Datenschutz

Hier liegt das höchste Risiko — entsprechend die intensivste Prüfung:

- **2-Säulen-Trennung erzwungen:** Automatisierter Test, dass der Service-Account
  `svc_operativ` (Optimierungs-Worker) **keinen Lesezugriff auf Säule 1** hat — der Versuch
  muss fehlschlagen.
- **Kein PII-Leck in Säule 2:** Negativtests gegen den `$jsonSchema`-Validator; der Versuch,
  Name/Adresse/Telefon in `klienten_operativ` zu schreiben, muss abgewiesen werden.
- **Verschlüsselung:** Nachweis, dass Säule-1-Felder verschlüsselt at rest liegen (CSFLE) und
  `pseudonym_id` im Klartext nur als Schlüssel dient.
- **Crypto-Shredding:** Test, dass nach Löschen des KMS-Schlüssels die zugehörigen
  Säule-2-Daten unumkehrbar anonym sind — auch im Restore aus Backup.
- **WORM-Audit-Log:** Nachweis, dass das Log append-only und manipulationssicher ist
  (HMAC-Kette prüfbar, `update`/`remove` verweigert).
- **Kein PII in Logs, Cache, URLs:** statische und dynamische Prüfungen.
- **OWASP-Basics + Dependency-Scanning:** SAST, `npm audit`/Dependabot, vor Go-Live ein
  Pentest der externen Angriffsfläche.

### 1.4 Schwerpunkt Optimierungs-Korrektheit

Ein falscher Fit-Score zerstört das Vertrauen der Disponenten. Daher:

- **Golden-Set-Tests:** kleine Szenarien mit bekanntem, von Hand verifiziertem Ergebnis
  (Mehrweg, Reihenfolge) als Regressionsschutz für den Solver.
- **Constraint-Tests:** Zeitfenster- und Qualifikations-Bedingungen werden nie verletzt
  (ein Vorschlag, der ein Zeitfenster sprengt, gilt als Fehler).
- **Determinismus/Stabilität:** gleiche Eingabe → stabile Rangfolge.

### 1.5 Schwerpunkt KI-Pflegelotse

LLM-Verhalten lässt sich nicht klassisch unit-testen, daher eine **Eval-Suite**:

- **Guardrail-Assertions:** Der Assistent verweigert medizinische/pflegefachliche Bewertung
  und Pflegegrad-Feststellung und verweist auf die Beratung nach §7a SGB XI.
- **Eval-Promptsatz** für Korrektheit, Halluzinations-Stichproben und Mehrsprachigkeit.
- **Datensparsamkeit:** Test, dass keine unnötigen personenbezogenen Daten an die API gehen.

### 1.6 Schwerpunkt Barrierefreiheit

Automatisiert (axe, Lighthouse) plus manuell (Tastatur, NVDA). Eigener Prüffall: die
**Text-/Tabellenalternative zur Karte** liefert dieselbe Information wie die visuelle Tour.

---

## 2. Abnahme

Abnahme erfolgt in **Gates**: Ein Release passiert nacheinander fachliche, nicht-funktionale
und — zwingend — das Datenschutz-/Sicherheits-Gate, bevor echte Nutzer es sehen.

### 2.1 Abnahmekriterien (Definition of Done)

Eine Funktion gilt als abnahmefähig, wenn: Akzeptanzkriterien erfüllt, alle automatisierten
Tests grün, NFR-Schwellen eingehalten (Fit-Score < 1 s, WCAG 2.1 AA), Sicherheits-/
Datenschutzprüfungen bestanden, Dokumentation aktualisiert.

### 2.2 Fachliche Abnahme (UAT im Pilot)

User-Acceptance-Test mit echten Disponenten und Diensten anhand von Abnahmeszenarien je
Funktion, u. a.:

- Disponent plant Tagestour und nimmt einen passenden Klienten per Ein-Klick auf → Tour
  ordnet sich korrekt neu.
- Angehöriger stellt Bedarf ein → Reverse Bidding → Auswahl eines Dienstes → Kontaktfreigabe
  → Abrechnungs-Event entsteht (leck-sicher).
- Bleibt eine Zusage aus, sendet das System nach 24 h automatisch eine verbindliche Absage.
- Import eines ERP-Beispiel-Exports landet korrekt in beiden Säulen.

### 2.3 Abnahme-Gate Datenschutz und Sicherheit (hartes Gate)

Vor Go-Live zwingend und nicht verhandelbar:

- **Datenschutz-Folgenabschätzung (DSFA, Art. 35 DSGVO).** Wegen umfangreicher Verarbeitung
  besonderer Kategorien (Gesundheitsdaten) plus Profiling/Matching ist eine DSFA
  voraussichtlich verpflichtend; sie ist durchzuführen und positiv abzuschließen.
- **Auftragsverarbeitungsverträge** liegen vor: mit den Pflegediensten, mit Stripe, Anthropic,
  dem Hosting/DB-Anbieter.
- **TOMs dokumentiert, VVT (Art. 30)** geführt; Lösch- (Art. 17) und Auskunftsprozesse
  (Art. 15) nachweislich funktionsfähig.
- Alle Prüfungen aus 1.3 bestanden; Pentest-Findings behoben.

*(DSFA und Vertragswerk fachjuristisch bzw. mit Datenschutzbeauftragten begleiten — keine
Rechtsberatung.)*

### 2.4 Abnahme Barrierefreiheit (BFSG)

WCAG-2.1-AA-Konformität der verbraucherorientierten Teile nachgewiesen; eine
Barrierefreiheitserklärung wird bereitgestellt. *(Anwendbarkeit des BFSG fachjuristisch
bestätigen.)*

### 2.5 Schnittstellen-Abnahme

Jeder ERP-Adapter wird einzeln gegen **reale Beispiel-Exporte des jeweiligen Herstellers**
(MediFox DAN, Vivendi, Snap) abgenommen — Mapping korrekt, idempotent, Säulen-Split sauber.

### 2.6 Mängelklassen und Go-Live-Gate

| Klasse | Beispiel | Wirkung auf Abnahme |
|---|---|---|
| Blocker | PII-Leck in Säule 2, RBAC-Bruch, Datenverlust | Go-Live gesperrt |
| Kritisch | Fit-Score falsch, 24-h-Absage feuert nicht, Abrechnung fehlerhaft | Go-Live gesperrt |
| Hoch | WCAG-AA-Verstoß, Adapter-Mapping fehlerhaft | vor Go-Live zu beheben |
| Mittel/Gering | UI-Detail, Übersetzungslücke | Nachlieferung möglich |

Go-Live erfolgt **gestaffelt**: zuerst die Pilotregion (Freiburg), danach Ausweitung.

### 2.7 Pilot als Realabnahme (Go/No-Go)

Die fachliche Schlussabnahme ist die Go-/No-Go-Entscheidung aus der Validierungsphase:
gemessen an Match-Rate, antwortenden Diensten und Zahlungsbereitschaft (Express-Käufe,
Gründungspreis-Zusagen). Technische Abnahme schaltet das System frei; der Pilot entscheidet,
ob aus dem freigeschalteten System ein tragfähiges Produkt wird.

---

## Querbezug

Das Konzept spiegelt die Risikoverteilung des Projekts: Der größte Testaufwand liegt dort,
wo der größte Schaden droht — bei der 2-Säulen-Datentrennung und der Korrektheit des
Matchings —, während der breite Rest automatisiert und solo-tauglich in der CI abgesichert
ist. Das Datenschutz-Gate (inkl. DSFA) ist die einzige nicht verhandelbare Hürde vor jedem
Go-Live.
