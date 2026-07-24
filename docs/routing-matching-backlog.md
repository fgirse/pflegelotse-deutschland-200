# Backlog: Routing & Matching — Abgleich gegen das Pflichtenheft

| Dokument-Information | |
|---|---|
| **Zweck** | Priorisierte Lückenliste aus dem Soll-Ist-Abgleich des Routing-/Matching-Moduls gegen `docs/PflichtenheftRoutenoptimierung_Pflegedienst.md` |
| **Scope-Entscheidung** | Gestuft: Marktplatz-Matcher jetzt ausbauen (Phase 1), Dispositions-Vollplaner nach Pflichtenheft als Phase 2 |
| **Stand** | 2026-07-19 |

## Ausgangsbefund

Der implementierte Code ist heute ein **Marktplatz-Passgenauigkeits-Matcher**: Er prüft, ob und an welcher Position ein *einzelner* Kandidat mit minimalem Mehrweg in eine *bereits fixe* Tour passt (Nearest-Insertion-Heuristik). Das Pflichtenheft (§5.2) beschreibt dagegen einen **Dispositions-Vollplaner**, der ganze Wochen-/Tagestouren from scratch optimiert (echter VRPTW-Solver, Karte, Drag&Drop, Soll-Ist, Umplanung).

Solide implementiert und getestet ist der **Constraint-Kern** (Zeitfenster, ArbZG §3/§4, Qualifikation, Bezugspflege) sowie die **Routing-Abstraktion** (austauschbare Provider Haversine/OSRM/HERE, Fallback-Resilienz, Matrix-Cache). Das ist ein tragfähiges Fundament.

Aufwand grob: **S** = < 1 Tag, **M** = 1–3 Tage, **L** = > 3 Tage / eigenes Konzept.

---

## Phase 1 — Matcher vervollständigen (kurzfristig, hoher Hebel)

Baut nur auf Vorhandenem auf. Reihenfolge: **1.1 zuerst** (größter Hebel, kleinster Aufwand), **1.2 + 1.5 bündeln** (fassen dieselbe Mehrweg-/Auslastungsrechnung in `simuliere()` an).

### 1.1 HERE als Default absichern — S, **Hoch** — ✅ ERLEDIGT (2026-07-19)
Heute ist Haversine (Luftlinie, 30 km/h fix) der Default; der HERE-Provider mit Live-Verkehr existiert, wird aber nicht standardmäßig genutzt. Der zentrale Produktnutzen („passgenaue Zusatzmarge auf reale Route") hängt an realer Fahrzeit.

- **Fertig, wenn** bei gesetztem `HERE_API_KEY` der `FallbackRoutingProvider` HERE als Primär nutzt und bei Timeout/Fehler nachweisbar auf Haversine zurückfällt, ohne dass der Request scheitert. Der Mehrweg in `FitMatch` basiert dann auf verkehrsbewussten Zeiten.
- **Test:** Erweiterung in `HereRoutingProvider.test.ts` — Mock liefert Fehler → Assertion, dass die Fallback-Kette eine gültige Matrix aus Haversine zurückgibt (kein Throw); zweiter Fall: HERE liefert → Matrixwerte weichen von Haversine ab.

**Umsetzung:** Provider-Auswahl in reine, testbare Funktion `waehleRoutingKern()` extrahiert (`src/server/routing/waehleRouting.ts`); `matching/service.ts` nutzt sie jetzt. Fehlkonfiguration (`ROUTING_PROVIDER=here`/`osrm` ohne Key/URL) degradiert nicht mehr still, sondern warnt laut und fällt auf Haversine zurück. Neue Tests: `FallbackRoutingProvider.test.ts` (Kette: Primär liefert → Ersatz ungenutzt; Fehler/Timeout → Ersatz, kein Throw) und `waehleRouting.test.ts` (Auswahl + Degradierungs-Warnung). **Bewusst nicht** der Laufzeit-Default auf `here` geflippt — man kann nicht auf einen Provider defaulten, der einen kostenpflichtigen API-Key braucht (sonst treffen Dev/Tests ungewollt die HERE-API). Aktivierung bleibt explizit über `ROUTING_PROVIDER=here` + `HERE_API_KEY`.

### 1.2 Hausbesuchsgrundzeit je Leistung/Patient — M, **Hoch** — ✅ ERLEDIGT (2026-07-19)
`HAUSBESUCH_GRUNDZEIT_MIN` steht global auf `0`. Das Pflichtenheft (§5.1.3) fordert eine je Besuch anfallende, separat ausgewiesene Grundzeit. Ohne sie sind Auslastung und ArbZG-Rechnung zu optimistisch → falsche „passt"-Aussagen.

- **Fertig, wenn** `grundzeitMin` als Feld am Einsatz/Bedarf existiert (nicht mehr global `0`), in `simuliere()` pro Stopp statt der Konstante addiert wird, und in Auslastung/ArbZG-Rechnung separat ausgewiesen ist.
- **Test:** `fitScore.test.ts` — Golden-Case mit zwei Einsätzen unterschiedlicher Grundzeit → geplante Ankunftszeiten und `arbeitszeitMin` verschieben sich exakt um die Summe der Grundzeiten; ein Fall kippt dadurch nachweisbar von `machbar=true` auf `false` am ArbZG-Deckel.

**Umsetzung:** Globale Konstante durch optionales Feld `grundzeitMin` ersetzt — in `domain.ts` an `einsatzSchema`, `klientOperativSchema` und `fitScoreRequest.kandidat`, in den Payload-Collections `Touren`/`Bedarfe` (defaultValue 0) und in der Assign-Route. Neue Hilfe `besuchsdauer(dauerMin, grundzeitMin)` in `fitScore.ts` addiert die Grundzeit je Besuch. `planeTour()` führt reine Leistungszeit (`pflegezeitMin`) und Grundzeit (`grundzeitMin`) getrennt und weist beide in den Kennzahlen aus; Grundzeit zählt (als echte Zeit am Klienten) zu Arbeitszeit/ArbZG und zur produktiven Seite der Auslastung. Der `$jsonSchema`-Validator sperrt nur PII (kein `additionalProperties: false`), daher keine Validator-Änderung nötig. Payload-Typen regeneriert. Ohne gesetzten Wert bleibt das Verhalten identisch (0).

> **Offen (bewusst nicht Teil von 1.2):** Eine tenant-weite Default-Grundzeit und eine je-Leistung-Tabelle (Leistungsstammdaten) sind nicht modelliert — heute wird der Wert je Einsatz/Bedarf getragen. Für „je Leistung" bräuchte es die Leistungsstammdaten aus §5.1.3, die noch fehlen.

### 1.3 Mitarbeiter-/Tour-Verfügbarkeit — M, **Hoch** — ✅ ERLEDIGT (2026-07-24)
Urlaub/Krankheit/Teilzeit (§5.1.2) sind im Tour-Modell nicht abgebildet. Der Matcher schlägt sonst Touren vor, die es an dem Tag gar nicht gibt.

- **Fertig, wenn** eine an dem `datum` nicht verfügbare Pflegekraft/Tour im Fan-out gar nicht erst als Kandidatentour erscheint (Urlaub/Krankheit) bzw. Teilzeit-Fenster den nutzbaren Zeitraum begrenzen.
- **Test:** Matching-Service-Test — Tour mit Abwesenheit am Zieldatum → `fitScore()` liefert sie nicht in den Ergebnissen; Tour mit Teilzeit-Endzeit 13:00 → Einsatz um 14:00 wird `machbar=false`.

**Umsetzung:** Da es (noch) keine Mitarbeiter-Collection gibt und Touren ohnehin pro Pflegekraft+Tag existieren, sitzt die Verfügbarkeit auf Tour-Ebene: `verfuegbar` (Flag, false = Urlaub/Krankheit → Tour fällt aus dem Matching) und `verfuegbarBis` (Teilzeit-Schichtende, Min seit Mitternacht) an `tourSchema` und der `Touren`-Collection, beide optional (Rückwärtskompatibilität). `fitScoreFuerTour()` gibt für nicht verfügbare Touren `null` zurück; `simuliere()` weist Einsätze ab, die nicht bis `verfuegbarBis` abgeschlossen sind. `berechneFitScore()` filtert nicht verfügbare Touren vor Zähl-/Grundlogik (`geprueft`, Kein-Treffer-Grund stimmen dadurch). `normTour()` reicht beide Felder durch. Payload-Typen regeneriert. Drei neue Tests (Ausschluss bei `verfuegbar=false`, Ablehnung nach Schichtende, Zulassung davor).

> **Offen (bewusst nicht Teil von 1.3):** Eine echte Mitarbeiter-Stammdatenverwaltung (§5.1.2 — Qualifikationen, Arbeitszeitmodelle, Urlaubskalender) fehlt weiterhin. Die Verfügbarkeit wird heute je Tour gesetzt, nicht aus einem Personalstamm abgeleitet.

### 1.4 Kapazitätsgrenze je Tour — S, Mittel — ✅ ERLEDIGT (2026-07-24)
Heute nur ArbZG-Deckel, keine harte Stopp-Zahl. Verhindert Überbuchung.

- **Fertig, wenn** ein optionales `maxEinsaetze` (bzw. Rest-Arbeitszeit) am Tour-Modell existiert und `fitScoreFuerTour()` bei Überschreitung `null` zurückgibt.
- **Test:** `fitScore.test.ts` — volle Tour (`einsaetze.length === maxEinsaetze`) → Kandidat wird abgelehnt, obwohl Zeitfenster/ArbZG passen würden.

**Umsetzung:** Optionales Feld `maxEinsaetze` an `tourSchema` und der `Touren`-Collection; ohne Angabe unbegrenzt (nur ArbZG/Zeitfenster greifen). `fitScoreFuerTour()` gibt als harte Bedingung `null` zurück, wenn `einsaetze.length >= maxEinsaetze` — noch vor der Routing-/Positionsrechnung. `normTour()` reicht das Feld durch, Payload-Typen regeneriert. Zwei neue Tests (volle Tour abgelehnt trotz passendem Zeitfenster/ArbZG; freie Tour nimmt auf).

### 1.5 Separater Tour-Endpunkt — S, Mittel — ✅ ERLEDIGT (2026-07-21)
Modell kennt nur `start` (Depot), keinen Endpunkt (§5.1.2). Der Rückweg der letzten Position wird dadurch unterschätzt. **Zusammen mit 1.2 umsetzen** — gleiche Rechnung.

- **Fertig, wenn** `ende`-Koordinaten am Tour-Modell existieren (Default = `start`) und der Rückweg vom letzten Stopp in Fahrzeit/Mehrweg einfließt.
- **Test:** `fitScore.test.ts` — Einfügen an letzter Position erhöht den Mehrweg um den geänderten Rückweg zum Endpunkt (Golden-Wert), nicht nur um den Hinweg.

**Umsetzung:** Optionales Feld `ende` (Koordinaten) an `tourSchema` und der `Touren`-Collection; ohne Angabe kehrt die Tour zum Startpunkt zurück (Rundtour zum Depot, Matrix-Index 0). Ein separater Endpunkt wird als zusätzlicher Matrix-Punkt angehängt. `simuliere()` bekommt einen `endeIdx`-Parameter und addiert den Rückweg vom letzten Stopp; `planeTour()` analog. `normTour()` reicht `ende` nur mit echten Koordinaten durch (die optionale Payload-Group liefert sonst null-Felder). Payload-Typen regeneriert.

> **Bewusste Entscheidung:** Der Rückweg ist echte Fahr- **und** Arbeitszeit (der Wagen fährt zum Depot zurück), zählt also auch zur ArbZG-Rechnung — nicht nur zur ausgewiesenen Fahrzeit. Das ist strenger/korrekter und hat drei bestehende Golden-Tests verschoben (ArbZG-Grenzfall 270→260 Min, Grundzeit-Arbeitszeit 110/140→130/160, Pause-Test-Matrix). Zwei neue Tests decken 1.5 ab: Rückweg zum Depot bzw. zu einem separaten Endpunkt fließt in den Mehrweg der letzten Position ein.

### 1.6 Geschlechts-/Präferenz-Constraint — S, Niedrig — ✅ ERLEDIGT (2026-07-24)
Modell kennt nur Bezugspflege; Geschlechtspräferenz (§5.1.1) ist eine häufige reale Anforderung.

- **Fertig, wenn** eine Präferenz (z. B. `geschlechtPflegekraft`) am Kandidaten als Soft Constraint in die Sortierung eingeht — analog `bezugspflegeErfuellt`, ohne `machbar` hart zu kippen.
- **Test:** `fitScore.test.ts` — zwei sonst gleichwertige Touren; die mit passender Präferenz wird vor der anderen sortiert.

**Umsetzung:** `pflegekraftGeschlecht` (`m`/`w`/`d`) an Tour und `geschlechtPraeferenz` (`m`/`w`) am Kandidaten/Klienten/Bedarf. Neues `praeferenzErfuellt`-Flag im `FitMatch`; `fitScoreFuerTour()` setzt es (Präferenz gesetzt und Geschlecht passt). Die Sortierung in `fitScore()` reiht jetzt: Bezugspflege → Geschlechtspräferenz → Mehrweg — beide weich, `machbar` bleibt unberührt. Felder in Collections `Touren`/`KlientenOperativ`/`Bedarfe`; `normTour`/`normKlient` reichen sie durch; Typen regeneriert. Zwei neue Tests (passende Präferenz zuerst; Bezugspflege hat Vorrang vor der Geschlechtspräferenz).

### 1.7 Performance-Messung 200/50 — S, Niedrig — ✅ ERLEDIGT (2026-07-24)
Die 60-s-Vorgabe (§6.1) ist für die Insertion-Heuristik heute unbelegt.

- **Fertig, wenn** ein reproduzierbarer Benchmark 200 Bedarfe gegen 50 Touren mit gecachter Matrix misst und die Gesamtzeit unter der 60-s-Vorgabe dokumentiert ist.
- **Test:** Benchmark-Skript (kein Unit-Test) mit festem Seed → protokollierte `rechenzeitMs` < 60000; als Regressions-Guard mit großzügiger Schwelle in CI.

**Umsetzung:** `fitScore.perf.test.ts` — deterministische Daten (indexbasierte Koordinaten, kein Zufall) für 50 Touren à 4 Einsätze und 200 Kandidaten, gewertet über gecachtes Haversine-Routing (kein Env-Load). Gemessen: **~70 ms** für 200×50 — Faktor ~850 unter der 60-s-Vorgabe. Der Test protokolliert die Zeit ins CI-Log und hält als Regressions-Guard `< 20 s` fest (großzügig). Hinweis: gilt für die aktuelle Nearest-Insertion-Heuristik; ein echter VRPTW-Solver (2.1/2.6) muss erneut gemessen werden.

---

## Phase 2 — Vollplaner nach Pflichtenheft (mittelfristig, eigenes Konzept)

**Harte Grenze:** Solange **2.1** fehlt, bleibt alles „Einzelklient in fixe Tour einfügen". Sobald der Solver steht, wird die heutige Insertion-Heuristik zum Spezialfall — dann lohnen 2.2–2.5.

### 2.1 Echter VRPTW-Solver — L, **Hoch** (Fundament)
Ganze Tour, Reihenfolge-Reoptimierung; OR-Tools o. ä. hinter dem bestehenden Provider-Interface (§5.2.1).

- **Fertig, wenn** ein Solver hinter einem `TourOptimizer`-Interface eine komplette Tour-Reihenfolge unter allen Hard Constraints (Zeitfenster, ArbZG, Qualifikation, Kapazität) berechnet und die heutige Insertion-Heuristik als degenerierter Fall (1 Kandidat, fixe Tour) erhalten bleibt.
- **Test:** Solver-Testsuite mit kleinen Instanzen bekannter Optimallösung → berechnete Gesamtfahrzeit == Optimum; Constraint-Verletzung in keiner Lösung.

### 2.2 Stammtouren + Wochenplanung — L, **Hoch**
Wiederkehrende Leistungen → Rahmenplan (§5.2.2).

- **Fertig, wenn** wiederkehrende Leistungen als Stammtour hinterlegbar sind und daraus ein Wochenrahmenplan generiert wird.
- **Test:** E2E — Stammtour „Mo/Mi/Fr 08:00" erzeugt für eine Kalenderwoche genau drei Tour-Instanzen mit korrekten Einsätzen.

### 2.3 Tagesplanung + kurzfristige Umplanung — L, **Hoch**
Autom. Anpassung an Tagesverfügbarkeit; Neuberechnung bei Krankmeldung/Notfall (§5.2.2).

- **Fertig, wenn** eine Krankmeldung die betroffenen Einsätze auf andere Touren des Tages neu verteilt und die Auswirkung (Fahrzeit, Zeitfenster-Verletzungen) angezeigt wird.
- **Test:** Szenario-Test — Pflegekraft fällt aus → alle ihre Einsätze werden gültig neu zugeordnet oder als „nicht platzierbar" markiert, keine stillen Verluste.

### 2.4 Soll-Ist-Abgleich — L, Mittel — **blockiert durch §5.3 (mobil)**
Geplante vs. erfasste Zeiten (§5.2.2). Setzt mobile Leistungserfassung (§5.3) voraus, die heute nicht existiert.

- **Fertig, wenn** erfasste Ist-Zeiten je Einsatz gegen die geplante Ankunft/Dauer gestellt und Abweichungen ausgewiesen werden.
- **Test:** Integrationstest — erfasste Ist-Zeit weicht ab → Abweichung erscheint in der Tagesübersicht.
- **Blocker:** §5.3-Mobilmodul muss zuerst existieren.

### 2.5 Kartenansicht + Drag-and-Drop — L, Mittel
Interaktive Karte, sofortige Neuberechnung bei manueller Anpassung (§5.2.3 / §10.2).

- **Fertig, wenn** Touren auf einer Karte dargestellt sind und ein per Drag verschobener Stopp sofort neue Fahrzeit/Zeitfenster-Status zeigt.
- **Test:** Playwright — Stopp verschieben → Kennzahl-Anzeige aktualisiert sich, Zeitfenster-Verletzung wird rot markiert.

### 2.6 Performance-Härtung Solver — M, begleitend zu 2.1
60-s-Grenze (§6.1) ist das eigentliche Performance-Risiko (Risikomatrix, Pflichtenheft).

- **Fertig, wenn** der Solver die 200/50-Instanz innerhalb 60 s löst — mit Zeitbudget/Abbruch, das die beste bis dahin gefundene Lösung zurückgibt.
- **Test:** Benchmark wie 1.7, aber gegen den Solver; harte Assertion `< 60 s`.

---

## Was bereits erfüllt ist (kein Handlungsbedarf)

Aus §5.2.1 sind folgende Restriktionen im Fit-Score vollständig implementiert und getestet:

- Zeitfenster als Hard Constraint (`fitScore.ts` — spätester Beginn)
- ArbZG §3 (max. 10 h) und §4 (Pflichtpause nach 6 h) (`fitScore.ts`, `ARBZG`-Konstanten)
- Qualifikationsanforderung (Tour ⊇ Kandidat)
- Bezugspflege als Soft Constraint (Sortierkriterium `bezugspflegeErfuellt`)
- Routing-Abstraktion mit HERE-Live-Verkehr, OSRM, Haversine-Fallback und Matrix-Cache

## Referenzen

- Pflichtenheft: `docs/PflichtenheftRoutenoptimierung_Pflegedienst.md`
- Code: `src/server/routing/`, `src/server/matching/` (`fitScore.ts`, `service.ts`, `matrixCache.ts`)
- Tests: `src/server/matching/fitScore.test.ts`, `src/server/routing/HereRoutingProvider.test.ts`
- Datenmodell: `src/collections/Touren.ts`, `src/collections/Bedarfe.ts`, `src/shared/domain.ts`
