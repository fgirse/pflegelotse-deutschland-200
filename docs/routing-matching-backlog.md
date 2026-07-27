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

### 2.1 Echter VRPTW-Solver — L, **Hoch** (Fundament) — ✅ ERLEDIGT (2026-07-25, Single-Tour)
Ganze Tour, Reihenfolge-Reoptimierung; OR-Tools o. ä. hinter dem bestehenden Provider-Interface (§5.2.1).

- **Fertig, wenn** ein Solver hinter einem `TourOptimizer`-Interface eine komplette Tour-Reihenfolge unter allen Hard Constraints (Zeitfenster, ArbZG, Qualifikation, Kapazität) berechnet und die heutige Insertion-Heuristik als degenerierter Fall (1 Kandidat, fixe Tour) erhalten bleibt.
- **Test:** Solver-Testsuite mit kleinen Instanzen bekannter Optimallösung → berechnete Gesamtfahrzeit == Optimum; Constraint-Verletzung in keiner Lösung.

**Umsetzung (Entscheidung: Pure-TS lokale Suche, nur Single-Tour-Sequencing):** Neuer Port `TourOptimizer` mit Adapter `LocalSearchTourOptimizer` (`tourOptimizer.ts`): Cheapest-Insertion-Konstruktion + 2-opt + Or-opt, deterministisch, in-process, keine Infra. Bewertet Reihenfolgen über das **exportierte `simuliere()`** aus dem Matcher — dieselben harten Restriktionen (Zeitfenster, ArbZG §3/§4, Schichtende, Kapazität, Endpunkt, Grundzeit), keine Doppel-Logik. Anbindung: `optimiereTour()` im Service (verplant das Ergebnis über `planeTour` für konsistente Ankunftszeiten/Kennzahlen) und Endpoint `POST /api/v1/tours/{id}/optimize` (Rollen disponent/admin, Mandantengrenze). Vier Tests: schlechte Reihenfolge → bekanntes Optimum (80→60); enges Zeitfenster erzwingt machbare Reihenfolge; leere Tour / Einzeltour trivial. Nearest-Insertion (`fitScoreFuerTour`) bleibt unverändert der Marktplatz-Spezialfall.

> **Bewusst nicht Teil (Folgeschritte):** Multi-Vehicle-Zuordnung (Einsatz→Pflegekraft über mehrere Touren) gehört zu 2.2/2.3. OR-Tools bleibt hinter demselben Port eine Option, falls je echtes Multi-Vehicle über Hunderte Stopps nötig wird.
>
> **Nachgezogen (2026-07-25):** Frontend-Auslöser umgesetzt — Button „Tour optimieren" je Tour im Dashboard-Zeitstrahl (`DashboardClient.tsx`), ruft `POST /api/v1/tours/{id}/optimize` und lädt die Seite neu; i18n `dashboard.optimieren`/`optimiert` in de+en. Solver-Performance gegen §6.1 gemessen (siehe 2.6).

### 2.2 Stammtouren + Wochenplanung — L, **Hoch** — ✅ ERLEDIGT (2026-07-25)
Wiederkehrende Leistungen → Rahmenplan (§5.2.2).

- **Fertig, wenn** wiederkehrende Leistungen als Stammtour hinterlegbar sind und daraus ein Wochenrahmenplan generiert wird.
- **Test:** E2E — Stammtour „Mo/Mi/Fr 08:00" erzeugt für eine Kalenderwoche genau drei Tour-Instanzen mit korrekten Einsätzen.

**Umsetzung (Entscheidungen: per-Stammeinsatz-Frequenz, idempotente Generierung):** Neue Säule-2-Collection `stammtouren` (pseudonym, wie `touren`) + Schema `stammtourSchema`/`stammEinsatzSchema` — jeder Stammeinsatz hat optional eigene `wochentage` (Default = die der Tour), plus Gültigkeitsraum `aktivAb`/`aktivBis`. `touren` bekommt `stammtourId` (Rückverweis). Reiner, deterministischer Planer `server/planning/wochenplan.ts`: `generiereWoche(stammtouren, montag)` erzeugt pro passendem Wochentag eine Tour mit den fälligen Einsätzen (leere Tage werden übersprungen); Datumsarithmetik in UTC (keine Zeitzonen-Effekte); `montagDerWoche()` normalisiert beliebige Eingabetage. Idempotenz: `filtereNeue()` + `ladeGenerierteTourKeys()` lassen bestehende Tag-Touren (inkl. manueller Änderungen) unangetastet, nur fehlende Tage werden ergänzt. Service `generiereWochenplan()`, Endpoint `POST /api/v1/stammtouren/generate` (Rollen disponent/admin), UI-Auslöser „Woche planen" im Dashboard (`WochenplanButton.tsx`), i18n `wochenplan` in de+en. Generierte Touren sind normale `Tour`-Docs → laufen sofort durch die gesamte Maschinerie (planeTour, Fit-Score, Optimizer/„Tour optimieren"). 8 Planer-Tests: Datumslogik, Abnahme-Fall (Mo/Mi/Fr → 3 Touren), per-Einsatz-Frequenz, keine leeren Touren, Gültigkeitsraum, Idempotenz-Filter.

> **Bewusst nicht Teil (Folgeschritte):** Tagesanpassung an Verfügbarkeit/Krankmeldung und kurzfristige Umplanung → 2.3. Exotische Wiederholungen (14-tägig, „jeder 2. Dienstag") — erst wöchentliche Wochentag-Sets. Stammtour-Pflege läuft vorerst über die Payload-Admin-UI (`/admin`); ein eigenes Frontend-CRUD ist optional. Vercel-Cron für rollierende Generierung (wie SLA) als einfacher Folgeschritt.

### 2.3 Tagesplanung + kurzfristige Umplanung — L, **Hoch** — ✅ ERLEDIGT (2026-07-25)
Autom. Anpassung an Tagesverfügbarkeit; Neuberechnung bei Krankmeldung/Notfall (§5.2.2).

- **Fertig, wenn** eine Krankmeldung die betroffenen Einsätze auf andere Touren des Tages neu verteilt und die Auswirkung (Fahrzeit, Zeitfenster-Verletzungen) angezeigt wird.
- **Test:** Szenario-Test — Pflegekraft fällt aus → alle ihre Einsätze werden gültig neu zugeordnet oder als „nicht platzierbar" markiert, keine stillen Verluste.

**Umsetzung (Entscheidungen: greedy Cheapest-Insertion, Vorschau→Bestätigen):** Reine Multi-Vehicle-Umverteilung `server/planning/umverteilung.ts` — `umverteile(verwaiste, zielTouren, routing)` verteilt die Einsätze schwierigste-zuerst (engstes Fenster, dann längste Dauer) über den bestehenden `fitScore` auf die beste machbare Tour, aktualisiert den Tour-Zustand fortlaufend; machbarkeitserhaltend, was nirgends passt → `nichtPlatzierbar` mit Grund (Qualifikation/Zeitfenster/keineTouren). **Invariante:** jeder verwaiste Einsatz taucht genau einmal auf (keine stillen Verluste). Service `planeUmverteilung` (Vorschau, kein Schreiben, mit Mehrfahrzeit-Impact je Zieltour via planeTour) und `wendeUmverteilungAn` (persistiert Zieltouren, Quelltour → verfuegbar=false, behält nur nicht platzierbare Einsätze). Endpoint `POST /api/v1/tours/{id}/aufloesen` (`?probe=1` = Vorschau). UI: je Tour „Auflösen (Krankmeldung)" → Vorschau-Panel (umverteilt/nicht platzierbar/Mehrfahrzeit) → Bestätigen/Abbrechen; i18n de+en. Nutzt Verfügbarkeit aus 1.3, Kapazität aus 1.4 und den Fit-Score-Kern wieder. 4 Szenario-Tests (günstigste Tour, Qualifikations-Ablehnung, Kapazitäts-Ausweichen, Invariante).

> **Bewusst nicht Teil (Folgeschritte):** Globale Tages-Neuoptimierung from scratch; Echtzeit-Benachrichtigung der Kräfte; die mobile Seite (§5.3). Keine automatische Beschaffung neuer Kräfte/Überstunden — nur die vorhandenen verfügbaren Touren. Bezugspflege/Geschlechtspräferenz fließen bei der Umverteilung nicht ein (liegen am Klienten, nicht am Tour-Einsatz).

### 2.4 Soll-Ist-Abgleich — L, Mittel — ✅ ERLEDIGT (2026-07-25, inkl. schlankem §5.3)
Geplante vs. erfasste Zeiten (§5.2.2). Setzt mobile Leistungserfassung (§5.3) voraus, die heute nicht existiert.

- **Fertig, wenn** erfasste Ist-Zeiten je Einsatz gegen die geplante Ankunft/Dauer gestellt und Abweichungen ausgewiesen werden.
- **Test:** Integrationstest — erfasste Ist-Zeit weicht ab → Abweichung erscheint in der Tagesübersicht.
- **Blocker (aufgelöst):** §5.3-Mobilmodul musste zuerst existieren.

**Umsetzung (Entscheidungen: eigene Mobil-Seite, Auto-Stempel):** Blocker entschärft durch einen **schlanken §5.3-Erfassungspfad** (nicht das ganze Mobilmodul). Datenmodell: Ist-Felder am Einsatz (`istAnkunft`/`istAbfahrt` Min seit Mitternacht, `erledigt`, `abweichungGrund`) in Schema + `Touren`-Collection. Mobile Seite `/erfassung` (`ErfassungClient.tsx`): handschuhtaugliche „Angekommen"/„Erledigt"-Buttons je Stopp, die die **Gerätezeit** stempeln (Client rechnet lokale Uhrzeit → vermeidet Server-Zeitzonen-Footgun). Endpoint `POST /api/v1/tours/{id}/erfassung` (Rollen pflegekraft/disponent/admin). Reiner Soll-Ist-Abgleich `server/planning/sollist.ts::sollIst(tour, routing)` — Soll aus `planeAblauf`, gegen `istAnkunft`; liefert Abweichung je Stopp (+ zu spät/− zu früh), Ausreißer-Flag (Schwelle 15 Min), Pünktlichkeitsquote. Service `berechneSollIst` bindet den Provider. Angezeigt in der Tagesübersicht (`TourTable`): Spalten Soll/Ist/Abw. (Ausreißer rot) + Pünktlichkeit je Tour. 3 Unit-Tests (Abweichung/Ausreißer/Quote, nicht Erfasste ausgeklammert, leerer Fall). Gesamte Suite 142 grün.

> **Bewusst nicht Teil (klar als §5.3-Folgeschritte markiert):** Offline/PWA/Sync, NFC-Zeiterfassung, pflegekraft-scoped Auth-Härtung, rechtssicherer Leistungsnachweis mit echten Zeitstempeln (§5.4), Remote-Wipe (§9.5). `/erfassung` ist ein funktionaler Keim von §5.3, nicht das vollständige Mobilmodul.

### 2.5 Kartenansicht + Drag-and-Drop — L, Mittel — ✅ ERLEDIGT (2026-07-25)
Interaktive Karte, sofortige Neuberechnung bei manueller Anpassung (§5.2.3 / §10.2).

- **Fertig, wenn** Touren auf einer Karte dargestellt sind und ein per Drag verschobener Stopp sofort neue Fahrzeit/Zeitfenster-Status zeigt.
- **Test:** Playwright — Stopp verschieben → Kennzahl-Anzeige aktualisiert sich, Zeitfenster-Verletzung wird rot markiert.

**Umsetzung (Entscheidungen: nur innerhalb einer Tour, Live-Vorschau + Speichern):** Die Karte (MapLibre `TourMap`) existierte bereits. Neu: ziehbare Stopp-Liste je Tour (`TourReorder.tsx`) mit nativem HTML5-Drag&Drop **plus** Hoch/Runter-Buttons als tastaturbedienbare Alternative (WCAG). Reine Ablauf-Rechnung aus `planeTour` in testbare Funktion `matching/tourPlan.ts::planeAblauf(tour, routing)` extrahiert — liefert Kennzahlen **und je Stopp `zeitfensterOk`** (bricht anders als `simuliere` bei Verletzung nicht ab). Service `planeReihenfolge()` (Permutations-Validierung, Vorschau ohne Schreiben / Persistieren), Endpoint `POST /api/v1/tours/{id}/reorder` (`probe=true` = Vorschau). Jeder Drop/Klick holt eine Server-Vorschau → sofort neue Fahrzeit + verletzte Stopps rot; „Speichern" persistiert. Toggle-Button „Reihenfolge" je Tour im Dashboard; i18n de+en. 2 Unit-Tests (`planeAblauf`: Verletzung je Stopp erkannt ohne Abbruch, gültige Reihenfolge alles ok) + Playwright-e2e (`e2e/reorder.spec.ts`: Umsortieren aktualisiert die Kennzahl sofort).

> **Bewusst nicht Teil (Folgeschritte):** Stopps *zwischen* Touren ziehen (deckt fachlich 2.3 „Auflösen/Umverteilen" ab); Marker-Dragging direkt auf der Karte; Undo/Verlauf.

### 2.6 Performance-Härtung Solver — M, begleitend zu 2.1 — ✅ GEMESSEN (2026-07-25)
60-s-Grenze (§6.1) ist das eigentliche Performance-Risiko (Risikomatrix, Pflichtenheft).

- **Fertig, wenn** der Solver die 200/50-Instanz innerhalb 60 s löst — mit Zeitbudget/Abbruch, das die beste bis dahin gefundene Lösung zurückgibt.
- **Test:** Benchmark wie 1.7, aber gegen den Solver; harte Assertion `< 60 s`.

**Messung:** `tourOptimizer.perf.test.ts` — deterministische Daten über gecachtes Haversine-Routing. Gemessen: **50 Touren × 4 Stopps (= 200 Stopps, §6.1-Szenario) in ~4 ms**; eine große Einzeltour mit **15 Stopps in ~3 ms**. Regressions-Guards `< 20 s` bzw. `< 10 s`, Zeiten ins CI-Log.

> **Zeitbudget/Abbruch bewusst nicht umgesetzt:** Bei den realen Tourgrößen (Millisekunden, ~4 Größenordnungen unter 60 s) unnötig. Ein explizites Zeitbudget mit „beste-bis-dahin"-Rückgabe wird erst relevant, wenn Multi-Vehicle (2.3) über viele hundert Stopps optimiert — dann hinter demselben `TourOptimizer`-Port nachrüstbar.

---

## Was bereits erfüllt ist (kein Handlungsbedarf)

Aus §5.2.1 sind folgende Restriktionen im Fit-Score vollständig implementiert und getestet:

- Zeitfenster als Hard Constraint (`fitScore.ts` — spätester Beginn)
- ArbZG §3 (max. 10 h) und §4 (Pflichtpause nach 6 h) (`fitScore.ts`, `ARBZG`-Konstanten)
- Qualifikationsanforderung (Tour ⊇ Kandidat)
- Bezugspflege als Soft Constraint (Sortierkriterium `bezugspflegeErfuellt`)
- Routing-Abstraktion mit HERE-Live-Verkehr, OSRM, Haversine-Fallback und Matrix-Cache

---

## Über das Routing/Matching hinaus (Berichtswesen §5.4)

### §5.4 Rechtssicherer Leistungsnachweis — ✅ ERLEDIGT (2026-07-25)
Erbrachte Leistungen je Patient, rechtssicher (§5.4 Berichtswesen).

**Umsetzung (Entscheidungen: hash-verkettetes Journal, Bestätigung = Leistungen + Kraft/Zeit):** Reine Hash-Ketten-Logik `server/nachweis/kette.ts` — jeder Eintrag trägt `prevHash` + `hash = HMAC(prevHash + kanonischer Kern)` mit `AUDIT_PEPPER`; `verifiziereKette()` erkennt geänderte, gelöschte oder umgeordnete Einträge. WORM-Collection `leistungsnachweise` (Säule 2, pseudonym, `create` ja / `update`+`delete` nein — wie `gdpr_audit_log`). Bestätigungs-Flow: auf `/erfassung` schreibt „Erledigt" über `POST /api/v1/tours/{id}/bestaetigung` einen revisionssicheren Eintrag (erbrachte Leistungen = angegeben oder die geplanten des Klienten) und markiert den Einsatz operativ als erledigt. Nachweis-Dokument `erzeugeNachweisDokument()` verbindet die pseudonymen Einträge mit der Identität aus **Säule 1** (CSFLE) — **nur zur Darstellung**, nie zurück nach Säule 2 (Invariante gewahrt) —, weist den Integritätsstatus der Kette aus und ist als druckbare Seite `/nachweis/{pseudonymId}` (mit Markdown-Export) sowie via `GET /api/v1/klienten/{pseudonymId}/leistungsnachweis` (Rollen disponent/admin) abrufbar. „Nachweis"-Link je erledigtem Stopp in der Tagesübersicht; i18n de+en. 5 Ketten-Tests (gültige Kette, Genesis, manipulierter/gelöschter Eintrag, falscher Pepper).

> **Folgeschritte:** Patienten-Unterschrift, Versichertennummer im Nachweis, per-Leistung-Abwahl in der Bestätigungs-UI. (DTA/DATEV → §8.3, siehe unten.)

### §5.4 Weitere Berichte (Mitarbeiterauslastung, Kilometernachweis) — ✅ ERLEDIGT (2026-07-27)
Berichtswesen (§5.4): Auslastungsgrad je Mitarbeiter, gefahrene Kilometer je Tour/Mitarbeiter.

**Umsetzung (Entscheidung: geometrische km-Schätzung):** Reine Aggregation `server/berichte/` — `tourKilometer()` schätzt km geometrisch (exportiertes `haversineKm` × Umwegfaktor 1,3 inkl. Rückweg zum Depot); `aggregiereBerichte()` gruppiert je Tour berechnete Kennzahlen nach `pflegekraftId` → **Mitarbeiterauslastung** (Touren, Einsätze, Arbeits-/Fahr-/Klientenzeit, Auslastung % = amKlienten/(amKlienten+Fahrzeit), km) und **Kilometernachweis** (je Tour). Service `berechneBerichte()` lädt die Touren des Zeitraums und rechnet je Tour über `planeTour` (an den Provider gebunden). Endpoints `GET /api/v1/berichte` (JSON) + `/berichte/csv?typ=auslastung|kilometer` (CSV/BOM), Rollen disponent/admin. UI-Seite `/berichte` (Zeitraum, zwei Tabellen, CSV-Downloads) + Dashboard-Link; i18n de+en. 5 Unit-Tests (km-Geometrie, Aggregation/Auslastung, CSV-Format).

> **Bewusst NICHT Teil:** Echte Straßen-km (bräuchte eine Distanzmatrix vom Provider — km sind hier geometrische Schätzung); Auslastung gegen Vertragsarbeitszeit (nicht erfasst). Qualitätsindikatoren (Pünktlichkeit) deckt der Soll-Ist-Abgleich (2.4) bereits ab.

### §8.3 Abrechnungs-Export (DATEV + Kassen) — ✅ ERLEDIGT (2026-07-26)
Leistungsdaten in Abrechnungsformate exportieren (§8.3).

**Umsetzung (Entscheidungen: abrechnungsvorbereitendes Kassen-CSV, Config je Mandant):** Fehlende Stammdaten-Schicht ergänzt — Collection `abrechnungskonfiguration` (je Mandant: Leistungskomplex-**Preise** + DATEV-Kopfdaten Berater-/Mandanten-Nr, WJ-Beginn, Erlös-/Debitorenkonto), gepflegt in `/admin`. Reiner CSV-Schreiber `server/abrechnung/csv.ts` (RFC-4180-Quoting, Komma-Dezimal). Aggregation `aggregat.ts` bepreist die Leistungen aus den **revisionssicheren `leistungsnachweise`** (Quelle, nicht die veränderbaren Touren) zu Positionen (je Leistung) und Buchungen (je Besuch); die Ketten-Integrität wird vor dem Export geprüft. **DATEV-Export** `datev.ts`: gültiger **EXTF-Buchungsstapel** (Format 700/Kat. 21) — Kopf-, Spalten- und Buchungszeilen (Debitor an Erlöskonto, Belegdatum DDMM, Umsatz mit Komma). **Kassen-Export** `kassen.ts`: bepreiste Positions-CSV. Endpoints `GET /api/v1/abrechnung/datev` (ANSI/Windows-1252) und `…/kassen` (UTF-8+BOM), Zeitraum via `?von&bis`, Rollen disponent/admin. UI-Seite `/abrechnung` (Zeitraum + zwei Download-Buttons) + Dashboard-Link; Säule-1-Namen nur zur Darstellung (Invariante gewahrt). 6 Unit-Tests (CSV-Escaping/Euro, Aggregation inkl. fehlender Preise, DATEV-Zeilenformat, Kassen-CSV).

> **Bewusst NICHT Teil (klar markiert):** das zertifizierte §302-EDIFACT-Kassen-Wire-Format inkl. IK-Nummern, Versichertennummern, Verschlüsselung/Signatur und Datenannahmestelle — eigener regulierter Strang. Der Kassen-Export ist abrechnungsvorbereitend, nicht das zertifizierte Format. Aktuelle amtliche Preistabellen trägt der Dienst selbst ein (Katalog-Preise fehlen/veraltet). DATEV-Feld-/Spaltenzahl vor Produktivimport gegen die Ziel-Formatversion validieren.

---

### §5.3 Mobiles Modul als PWA — ✅ ERLEDIGT (2026-07-26)
Echte mobile Leistungserfassung: installierbar, offline-fähig (§5.3 / §9.5 / §10.3).

**Umsetzung (Entscheidungen: echtes Offline mit Queue+Sync, pflegekraftId am Nutzer):** `/erfassung` von der schlanken Seite zur **PWA** ausgebaut. Installierbar: `public/manifest.webmanifest` (standalone, Theme, Icons via sharp erzeugt `public/icons/icon-192|512.png`) + handgeschriebener Service Worker `public/sw.js` (App-Shell/Static cache-first, Navigation network-first mit Offline-Fallback; kein Precache der Auth-Seite) + `PwaRegister`. **Offline-Kern:** Tagestour in IndexedDB gespiegelt (`idb.ts`); Erfassungen laufen in eine lokale Warteschlange (`queue.ts`, rein & getestet) und werden bei Verbindung automatisch nachgespielt; Online/Offline-Anzeige + „n ausstehend". **Idempotenz:** jede Aktion trägt eine `aktionId` (UUID); `leistungsnachweise.aktionId` + `existiertNachweisAktion()` → `bestaetigeLeistung` überspringt bereits verbuchte Aktionen (kein Doppel-Eintrag bei Replay). **Kraft-Scoping (§9.5):** Feld `pflegekraftId` am Nutzer + Endpoint `GET /api/v1/erfassung/heute?datum=` liefert nur die heutige Tour DIESER Kraft (Client sendet Gerätedatum). Dazu: **Navigation-Handoff** je Stopp (Google/Apple Maps) und **Abweichung melden** (`event:'abweichung'`). Handschuhtaugliche Buttons (§10.3). 3 Queue-Unit-Tests (Enqueue-Idempotenz, Flush behält Fehlgeschlagene, kein Verlust bei Fehler).

> **Bewusst NICHT Teil (klar markiert):** NFC-Zeiterfassung, Remote-Wipe bei Geräteverlust (§9.5 — braucht Push/Geräte-Registrierung), Ende-zu-Ende-Verschlüsselung über TLS hinaus, Push-Benachrichtigungen, Background-Sync-API (stattdessen robuster `online`-Listener-Flush). PWA-Icons sind generische Platzhalter.

### §8.2 TI-Anbindung (eVerordnung) — ✅ ERLEDIGT (2026-07-26, Software-Seite)
Schnittstellen zur Telematikinfrastruktur (§8.2). Siehe `docs/ti-anbindung.md` für die Grenze real ↔ zertifiziertes Umfeld.

**Umsetzung (Entscheidungen: eVO substanziell, KIM/ePA nur Port+Stub, vereinfachtes JSON):** Vollständige TI ist ohne Konnektor/SMC-B/zugelassene Fachdienste/gematik-Zulassung nicht baubar — umgesetzt ist die **Software-Seite**. Port-Schicht `server/ti/ports.ts` (`EvoEingang`, `KimVersand`, `EpaLesen`) + Stubs. **eVerordnung eingehend (real):** vereinfachtes, fachlich korrektes Schema `evo.ts` + reiner Mapper `mappeEvo()` mit **Zwei-Säulen-Trennung** (Patient-PII → Säule 1, verordnete Leistungen/Zeitraum → Säule 2). Service `verarbeiteEvo()`: idempotent über `verordnungId`, Adress-Geocoding, Anlage Identität + operativer Klient + Verordnung, KIM-Rückmeldung (Stub). Collection `verordnungen` (Säule 2, append-only, kein PII). Endpoint `POST /api/v1/ti/evo` (Stub-Transport; im Betrieb liefert der KIM-Fachdienst/Konnektor die Nutzlast). Env-Platzhalter `TI_KONNEKTOR_URL`/`TI_SMCB_ID`/`TI_KIM_ADRESSE`. 5 Unit-Tests (Schema, Zwei-Säulen-Mapping, Leistungen/Zeitraum-Übertragung).

> **Bewusst NICHT Teil (klar markiert):** echter Konnektor/SMC-B/TLS, gematik-Zulassung, KBV-FHIR-Vollprofil, KIM vollständig (S/MIME über TI), echter ePA-Zugriff (VSDM/Einwilligung), Patienten-Dedup über Versichertennummer (KVNR wird als externalId schon mitgeführt).

---

## Referenzen

- Pflichtenheft: `docs/PflichtenheftRoutenoptimierung_Pflegedienst.md`
- Code: `src/server/routing/`, `src/server/matching/` (`fitScore.ts`, `service.ts`, `matrixCache.ts`)
- Tests: `src/server/matching/fitScore.test.ts`, `src/server/routing/HereRoutingProvider.test.ts`
- Datenmodell: `src/collections/Touren.ts`, `src/collections/Bedarfe.ts`, `src/shared/domain.ts`
