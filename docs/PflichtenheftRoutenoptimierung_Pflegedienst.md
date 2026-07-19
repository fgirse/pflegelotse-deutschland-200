# Pflichtenheft
## Browserbasierte Routenoptimierungssoftware für ambulante Pflegedienste

---

| Dokument-Information | |
|---|---|
| **Titel** | Pflichtenheft: Browserbasierte Routenoptimierungssoftware für ambulante Pflegedienste |
| **Version** | 1.0 |
| **Datum** | 01. Juli 2026 |
| **Status** | Freigegeben zur Umsetzung |
| **Autor** | Manus AI |
| **Zielgruppe** | Auftragnehmer (Softwareentwicklung), Auftraggeber (Pflegedienst-Betreiber), Projektleitung |

---

## Versionshistorie

| Version | Datum | Autor | Änderungsbeschreibung |
|---|---|---|---|
| 0.1 | 15.05.2026 | Manus AI | Ersterstellung auf Basis der Anforderungsanalyse |
| 1.0 | 01.07.2026 | Manus AI | Freigabe nach interner Prüfung |

---

## Inhaltsverzeichnis

1. Einleitung und Zweck des Dokuments
2. Ausgangssituation und Problemstellung
3. Projektziele und Abgrenzung
4. Beteiligte Stakeholder und Benutzerrollen
5. Funktionale Anforderungen
6. Nicht-funktionale Anforderungen
7. Systemarchitektur und Technologierahmen
8. Schnittstellen und Integrationen
9. Datenschutz und Datensicherheit
10. Benutzeroberfläche und Bedienkonzept
11. Testkonzept und Abnahmekriterien
12. Projektplanung und Meilensteine
13. Risiken und Gegenmaßnahmen
14. Glossar
15. Referenzen

---

## 1. Einleitung und Zweck des Dokuments

Dieses Pflichtenheft beschreibt verbindlich, wie die im Lastenheft formulierten Anforderungen an eine browserbasierte Routenoptimierungssoftware für ambulante Pflegedienste technisch und fachlich umgesetzt werden sollen. Es dient als vertragliche Grundlage zwischen Auftraggeber und Auftragnehmer und bildet die Basis für Entwicklung, Test und Abnahme der Software.

Die ambulante Pflege in Deutschland steht unter erheblichem Druck: Steigende Patientenzahlen, wachsender Fachkräftemangel und zunehmende regulatorische Anforderungen — insbesondere durch die verpflichtende Anbindung an die Telematikinfrastruktur (TI) ab dem 1. Juli 2025 [^1] — erfordern den Einsatz moderner, digitaler Planungsinstrumente. Eine intelligente Routenoptimierungssoftware ist dabei kein Komfortwerkzeug, sondern eine betriebliche Notwendigkeit.

Das vorliegende Dokument richtet sich an alle am Projekt beteiligten Parteien: die Geschäftsführung und Pflegedienstleitung des Auftraggebers, das beauftragte Entwicklungsteam sowie externe Prüfstellen für Datenschutz und Compliance.

---

## 2. Ausgangssituation und Problemstellung

### 2.1 Beschreibung des Ist-Zustands

In der Praxis ambulanter Pflegedienste wird die Tourenplanung häufig noch manuell oder mit einfachen Tabellenkalkulationsprogrammen durchgeführt. Dieser Ansatz stößt angesichts der Komplexität des Problems — der simultanen Optimierung von Routen, Zeitfenstern, Qualifikationen und Personalverfügbarkeiten — schnell an seine Grenzen [^2]. Typische Symptome des Ist-Zustands sind:

Pflegekräfte verbringen unverhältnismäßig viel Zeit im Fahrzeug, weil Routen nicht geometrisch optimiert werden. Kurzfristige Änderungen (z.B. Krankmeldungen oder Notfälle) führen zu erheblichem manuellem Koordinationsaufwand. Die Einhaltung von Zeitfenstern für zeitkritische Leistungen (z.B. Insulingabe, Medikamentenvergabe) ist schwer zu gewährleisten. Leistungsnachweise werden auf Papier erfasst und müssen nachträglich manuell in Abrechnungssysteme übertragen werden, was fehleranfällig und zeitaufwendig ist.

### 2.2 Regulatorischer Handlungsdruck

Zusätzlich zu den betrieblichen Herausforderungen entsteht durch die Gesetzgebung ein erheblicher Handlungsdruck. Ab dem 1. Juli 2025 ist die Anbindung aller ambulanten Pflegeeinrichtungen an die Telematikinfrastruktur (TI) nach § 125 SGB XI verpflichtend [^1]. Ab dem 1. Juli 2026 müssen Verordnungen für häusliche Krankenpflege verpflichtend als elektronische Verordnung (eVO) übermittelt werden [^1]. Jede eingesetzte Software muss diese Anforderungen technisch unterstützen.

---

## 3. Projektziele und Abgrenzung

### 3.1 Projektziele

Das Projekt verfolgt folgende übergeordnete Ziele, die durch die Software zu erreichen sind:

| Ziel | Messgröße | Zielwert |
|---|---|---|
| Reduzierung der durchschnittlichen Fahrtzeit pro Tour | Fahrtzeit in Minuten | Reduktion um mindestens 15 % gegenüber Ist-Zustand |
| Entlastung der Disposition | Zeitaufwand für Tagesplanung | Reduktion um mindestens 30 % |
| Vollständige DSGVO-Konformität | Datenschutz-Audit | Keine kritischen Befunde |
| TI-Readiness | Technische Zertifizierung | Nachweis der TI-Kompatibilität |
| Mitarbeiterzufriedenheit | Interne Befragung | Verbesserung um mindestens eine Stufe auf einer 5-Punkte-Skala |

### 3.2 Abgrenzung (Nicht-Ziele)

Die Software ersetzt **nicht** die vollständige Pflegedokumentationssoftware (z.B. Pflegeplanung, Pflegeberichte). Sie ist als spezialisiertes Modul für Routen- und Einsatzplanung konzipiert, das über definierte Schnittstellen mit bestehenden Pflegesoftwaresystemen kommuniziert. Die Verwaltung von Pflegeverträgen, die Abrechnung gegenüber Kostenträgern sowie die medizinische Dokumentation liegen außerhalb des Projektumfangs.

---

## 4. Beteiligte Stakeholder und Benutzerrollen

Die Software wird von verschiedenen Benutzergruppen mit unterschiedlichen Berechtigungen und Anforderungen genutzt. Das Berechtigungskonzept ist rollenbasiert (Role-Based Access Control, RBAC) zu implementieren.

| Rolle | Beschreibung | Zugriffsrechte |
|---|---|---|
| **Administrator** | IT-Verantwortlicher des Pflegedienstes | Vollzugriff; Benutzerverwaltung, Systemkonfiguration |
| **Pflegedienstleitung (PDL)** | Strategische Planung, Qualitätssicherung | Lesezugriff auf alle Touren und Berichte; keine Bearbeitung von Patientenstammdaten |
| **Disponent / Tourenplaner** | Operative Tagesplanung | Vollzugriff auf Tourenplanung, Stammdaten, Berichte |
| **Pflegekraft (Außendienst)** | Durchführung der Pflegeeinsätze | Nur eigene Tagestouren, Leistungserfassung, Navigationsfunktion |
| **Verwaltung** | Abrechnungsvorbereitung | Lesezugriff auf Leistungsnachweise und Abrechnungsdaten |

---

## 5. Funktionale Anforderungen

### 5.1 Stammdatenverwaltung

#### 5.1.1 Patientenstammdaten

Das System muss die Erfassung und Pflege vollständiger Patientenstammdaten ermöglichen. Dazu gehören neben den Basisdaten (Name, Adresse, Kontaktdaten) folgende pflegerelevante Informationen:

Die Software muss den **Pflegegrad** (1–5 gemäß § 15 SGB XI) sowie die zugehörigen Leistungskomplexe nach SGB V und SGB XI hinterlegen können. Für jeden Patienten müssen **Zeitfenster** definierbar sein, innerhalb derer bestimmte Leistungen erbracht werden müssen (z.B. Insulingabe zwischen 07:30 und 08:30 Uhr). Darüber hinaus müssen **Patientenpräferenzen** erfasst werden, wie die Bevorzugung einer bestimmten Pflegekraft (Bezugspflege) oder Anforderungen an das Geschlecht der Pflegekraft.

#### 5.1.2 Mitarbeiterstammdaten

Die Verwaltung der Mitarbeiterdaten umfasst Qualifikationen und Berechtigungen (z.B. Behandlungspflege nach SGB V nur durch examinierte Fachkräfte), Arbeitszeitmodelle und Vertragsarbeitszeiten, Verfügbarkeiten (Urlaub, Krankheit, Teilzeit), sowie den geographischen Start- und Endpunkt der täglichen Tour (Wohnadresse oder Betriebssitz).

#### 5.1.3 Leistungsstammdaten

Alle Leistungskomplexe nach SGB V und SGB XI müssen hinterlegt werden können, inklusive der zugehörigen Standardzeiten (Pflegezeiten). Das System muss die Möglichkeit bieten, eine **Hausbesuchsgrundzeit** zu definieren, die einmalig pro Patientenbesuch anfällt und Begrüßung, Krankenbeobachtung und Dokumentationszeit abdeckt [^2]. Diese Grundzeit wird nicht mit den reinen Pflegezeiten der einzelnen Leistungen addiert, sondern separat ausgewiesen.

### 5.2 Tourenplanung und Routenoptimierung

#### 5.2.1 Optimierungsalgorithmus

Das Herzstück der Software bildet ein Algorithmus zur Lösung des **Vehicle Routing Problem with Time Windows (VRPTW)** [^4]. Dieser muss folgende Restriktionen simultan berücksichtigen:

- Geografische Distanzen und Fahrzeiten auf Basis von Echtzeit-Kartendaten.
- Zeitfenster für einzelne Pflegeleistungen (hard constraints).
- Qualifikationsanforderungen: Nur Mitarbeiter mit der erforderlichen Qualifikation werden für bestimmte Leistungen eingeplant.
- Arbeitszeit- und Pausenregelungen gemäß Arbeitszeitgesetz (ArbZG): Maximal 10 Stunden Arbeitszeit täglich, Mindestpausen nach 6 Stunden Arbeit.
- Präferenzen und Wünsche (soft constraints, z.B. Bezugspflege).

#### 5.2.2 Planungsworkflow

Der Planungsprozess muss folgende Schritte unterstützen:

**Wochenplanung:** Erstellung eines Rahmenplans für die gesamte Woche auf Basis der Stammtouren und wiederkehrenden Leistungen. **Tagesplanung:** Automatische Anpassung des Tagesplans unter Berücksichtigung aktueller Verfügbarkeiten. **Soll-Ist-Abgleich:** Kontinuierlicher Vergleich der geplanten Zeiten mit den tatsächlich erfassten Zeiten der Pflegekräfte [^2]. **Kurzfristige Umplanung:** Bei unvorhergesehenen Ereignissen (Krankmeldung, Notfall) muss eine sofortige Neuberechnung der betroffenen Touren möglich sein.

#### 5.2.3 Kartografische Visualisierung

Alle geplanten Touren müssen auf einer interaktiven Karte dargestellt werden. Die Visualisierung muss Doppelwege und ineffiziente Routenführung sofort erkennbar machen [^2]. Disponenten müssen Touren per Drag-and-Drop manuell anpassen können, wobei das System die Auswirkungen auf Fahrtzeiten und Zeitfenster sofort berechnet und anzeigt.

### 5.3 Mobile Leistungserfassung

#### 5.3.1 Anforderungen an die mobile Ansicht

Pflegekräfte greifen über mobile Endgeräte (Smartphone, Tablet) auf ihre Tagestouren zu. Die mobile Ansicht muss folgende Funktionen bieten:

Anzeige der aktuellen Tagesroute mit allen Patientenbesuchen in chronologischer Reihenfolge, inklusive geplanter Ankunftszeiten. Integration einer Navigationsfunktion (z.B. Übergabe an Google Maps oder Apple Maps). Digitale Leistungserfassung: Pflegekräfte bestätigen erbrachte Leistungen per Klick und hinterlegen bei Bedarf Kommentare. Automatische Zeitstempelung bei An- und Abreise (optional: NFC-basierte Zeiterfassung beim Patienten). Möglichkeit zur Meldung von Abweichungen (z.B. Patient nicht angetroffen, Zustandsänderung).

#### 5.3.2 Offline-Fähigkeit

Da Pflegekräfte in Gebieten mit schlechter Netzabdeckung arbeiten können, muss die mobile Anwendung **offline-fähig** sein. Tagestouren und Patientendaten werden beim Start des Arbeitstages auf das Gerät synchronisiert. Erfasste Leistungen werden lokal gespeichert und bei Wiederherstellung der Verbindung automatisch synchronisiert.

### 5.4 Berichtswesen und Auswertungen

Das System muss ein umfassendes Berichtswesen bereitstellen:

| Bericht | Beschreibung | Zielgruppe |
|---|---|---|
| **Tagesübersicht** | Alle Touren des Tages mit Soll-Ist-Vergleich | Disponent, PDL |
| **Mitarbeiterauslastung** | Auslastungsgrad je Mitarbeiter pro Woche/Monat | PDL, Verwaltung |
| **Kilometernachweis** | Gefahrene Kilometer je Tour und Mitarbeiter | Verwaltung, Buchhaltung |
| **Leistungsnachweis** | Erbrachte Leistungen je Patient (rechtssicher) | Verwaltung, Abrechnung |
| **Qualitätsindikatoren** | Pünktlichkeitsquote, Abweichungsrate | PDL |

---

## 6. Nicht-funktionale Anforderungen

### 6.1 Performance

Die Software muss auch unter Spitzenlast performant arbeiten. Die Routenoptimierung für einen Pflegedienst mit bis zu 200 Patienten und 50 Mitarbeitern muss innerhalb von **maximal 60 Sekunden** abgeschlossen sein. Die Ladezeit einzelner Seiten in der Webanwendung darf unter normalen Netzwerkbedingungen **3 Sekunden** nicht überschreiten.

### 6.2 Verfügbarkeit und Betrieb

Da die Tourenplanung ein betriebskritischer Prozess ist, muss die Software eine **Verfügbarkeit von mindestens 99,5 %** (gemessen auf Monatsbasis) gewährleisten. Geplante Wartungsfenster sind außerhalb der Kernarbeitszeiten (06:00–22:00 Uhr) durchzuführen und mindestens 48 Stunden im Voraus anzukündigen. Ein Notfallbetrieb muss sichergestellt sein.

### 6.3 Skalierbarkeit

Die Systemarchitektur muss so ausgelegt sein, dass sie ohne grundlegende Umbauten auf Pflegedienste unterschiedlicher Größe skaliert werden kann — von kleinen Diensten mit 20 Patienten bis zu großen Trägern mit mehreren Standorten und über 500 Patienten.

### 6.4 Benutzerfreundlichkeit

Die Einarbeitungszeit für Disponenten ohne spezifische IT-Vorkenntnisse darf **maximal zwei Arbeitstage** betragen. Die Software muss in **deutscher Sprache** verfügbar sein. Für Pflegekräfte mit nicht-deutschsprachigem Hintergrund ist eine mehrsprachige Oberfläche (mindestens Türkisch, Russisch, Arabisch) für die mobile Ansicht wünschenswert.

---

## 7. Systemarchitektur und Technologierahmen

### 7.1 Architekturprinzipien

Die Software wird als **Software-as-a-Service (SaaS)** auf Basis einer modernen Web-Architektur realisiert. Sie ist vollständig browserbasiert und erfordert keine lokale Installation auf den Endgeräten der Nutzer. Die Architektur folgt dem Prinzip der Mandantenfähigkeit (Multi-Tenancy), sodass mehrere Pflegedienste die Plattform nutzen können, ohne dass ihre Daten vermischt werden.

### 7.2 Technologiestack (Empfehlungen)

| Schicht | Technologie | Begründung |
|---|---|---|
| **Frontend** | React / Vue.js + TypeScript | Moderne, wartbare SPA-Architektur |
| **Backend** | REST-API (Node.js / Python) | Standardisierte Schnittstellen |
| **Datenbank** | PostgreSQL (relational) | ACID-Konformität für Abrechnungsdaten |
| **Kartendienst** | OpenStreetMap / HERE Maps | Datenschutzfreundlich, EU-basiert |
| **Optimierungsengine** | OR-Tools (Google) / eigene Implementierung | Bewährte VRP-Lösung |
| **Hosting** | EU-Rechenzentrum (z.B. AWS Frankfurt, Azure West Europe) | DSGVO-Konformität |
| **Mobile** | Progressive Web App (PWA) | Plattformunabhängig, offline-fähig |

---

## 8. Schnittstellen und Integrationen

### 8.1 Kartendienste und Verkehrsdaten

Die Software muss eine Schnittstelle zu einem Echtzeit-Kartendienst bereitstellen, der aktuelle Verkehrsdaten für die Fahrzeitberechnung liefert. Bevorzugt werden EU-basierte Anbieter (z.B. HERE Maps, TomTom), um die DSGVO-Konformität zu gewährleisten.

### 8.2 Telematikinfrastruktur (TI)

Die Integration in die Telematikinfrastruktur ist gemäß den Vorgaben der gematik GmbH zu realisieren [^1] [^5]. Folgende TI-Anwendungen sind zu unterstützen:

**KIM (Kommunikation im Medizinwesen):** Empfang und Versand von Arztbriefen, Verordnungen und Befunden über das sichere Kommunikationsnetz. **Elektronische Patientenakte (ePA):** Lesezugriff auf relevante Patientendaten (mit Einwilligung des Patienten). **Elektronische Verordnung (eVO):** Empfang und Verarbeitung von Verordnungen für häusliche Krankenpflege, ab dem 1. Juli 2026 verpflichtend [^1].

Die technischen Voraussetzungen (Konnektor oder VPN-Zugangsdienst, SMC-B-Karte) werden auf Seiten des Auftraggebers bereitgestellt. Die Software muss die entsprechenden Schnittstellen implementieren.

### 8.3 Abrechnungssysteme

Die Software muss Leistungsdaten in Formate exportieren können, die von gängigen Abrechnungssystemen verarbeitet werden. Mindestanforderung ist der Export im **DTA-Format** (Datenträgeraustausch) für die elektronische Abrechnung mit Kranken- und Pflegekassen sowie eine **DATEV-kompatible** Exportfunktion für die Finanzbuchhaltung.

### 8.4 Bestehende Pflegesoftware

Über eine dokumentierte REST-API müssen Daten mit bestehenden Pflegedokumentationssystemen (z.B. MediFox, Snap, Euregon) ausgetauscht werden können. Mindestanforderung ist ein bidirektionaler Datenaustausch für Patientenstammdaten und Leistungsnachweise.

---

## 9. Datenschutz und Datensicherheit

### 9.1 Rechtliche Grundlagen

Die Software verarbeitet Gesundheitsdaten, die nach **Art. 9 DSGVO** als besondere Kategorien personenbezogener Daten eingestuft sind und damit dem höchsten Schutzniveau unterliegen [^3]. Die Verarbeitung ist auf die für den Pflegebetrieb zwingend notwendigen Daten zu beschränken (Datensparsamkeit, Art. 5 Abs. 1 lit. c DSGVO).

### 9.2 Technische und organisatorische Maßnahmen (TOMs)

Gemäß **Art. 32 DSGVO** sind angemessene technische und organisatorische Schutzmaßnahmen zu implementieren [^3]:

| Maßnahme | Anforderung |
|---|---|
| **Verschlüsselung (at rest)** | AES-256 für alle gespeicherten Daten |
| **Verschlüsselung (in transit)** | TLS 1.3 für alle Datenübertragungen |
| **Authentifizierung** | Starke Passwörter (mind. 12 Zeichen) + Zwei-Faktor-Authentifizierung (2FA) als Option |
| **Zugriffsprotokollierung** | Lückenloses Audit-Log aller Datenzugriffe und -änderungen |
| **Datensicherung** | Tägliche verschlüsselte Backups, Wiederherstellungszeit < 4 Stunden |
| **Mandantentrennung** | Strikte logische Trennung der Daten verschiedener Pflegedienste |
| **Hosting** | Ausschließlich auf Servern innerhalb der EU |

### 9.3 Auftragsverarbeitungsvertrag (AVV)

Der Softwareanbieter verarbeitet personenbezogene Daten im Auftrag des Pflegedienstes. Es ist zwingend ein **Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO** abzuschließen, der Gegenstand, Dauer und Zweck der Verarbeitung, die Kategorien der betroffenen Daten, die technischen und organisatorischen Maßnahmen sowie die Pflichten bei Datenpannen regelt [^3].

### 9.4 Betroffenenrechte

Das System muss die Ausübung der Betroffenenrechte nach DSGVO technisch unterstützen. Dazu gehören die Möglichkeit zur vollständigen Datenauskunft (Art. 15 DSGVO), die Berichtigung fehlerhafter Daten (Art. 16 DSGVO), die Löschung von Daten nach Ende des Pflegeverhältnisses unter Berücksichtigung gesetzlicher Aufbewahrungsfristen (Art. 17 DSGVO) sowie die Einschränkung der Verarbeitung (Art. 18 DSGVO).

### 9.5 Umgang mit mobilen Endgeräten

Da Pflegekräfte mit mobilen Geräten auf Patientendaten zugreifen, gelten besondere Anforderungen [^3]. Auf dem mobilen Gerät dürfen nur die für den aktuellen Arbeitstag notwendigen Daten gespeichert sein. Bei Geräteverlust muss ein Remote-Wipe der App-Daten möglich sein. Die Übertragung zwischen mobilem Gerät und Server muss stets verschlüsselt erfolgen.

---

## 10. Benutzeroberfläche und Bedienkonzept

### 10.1 Allgemeine Gestaltungsprinzipien

Die Benutzeroberfläche folgt den Prinzipien des **User-Centered Design**. Sie muss auch unter Zeitdruck und in stressigen Situationen (z.B. kurzfristige Umplanungen) fehlerfrei und schnell bedienbar sein. Das Design muss klar, strukturiert und ablenkungsarm sein.

### 10.2 Hauptansichten der Webanwendung

**Planungsboard (Dispatcher-Ansicht):** Die zentrale Ansicht zeigt alle Touren des Tages in einer Kalender- oder Kanban-Darstellung sowie die zugehörige Kartenansicht. Disponenten können Touren per Drag-and-Drop anpassen. **Kartenansicht:** Interaktive Karte mit allen Patientenstandorten und geplanten Routen. Farbkodierung nach Mitarbeiter und Status (geplant, in Bearbeitung, abgeschlossen). **Stammdatenverwaltung:** Übersichtliche Formulare zur Pflege von Patienten-, Mitarbeiter- und Leistungsdaten. **Berichtswesen:** Dashboard mit den wichtigsten Kennzahlen und Möglichkeit zur Erstellung individueller Berichte.

### 10.3 Mobile Ansicht

Die mobile Ansicht ist als **Progressive Web App (PWA)** zu realisieren und muss auf Smartphones mit einer Bildschirmdiagonale ab 5 Zoll vollständig bedienbar sein. Die Darstellung beschränkt sich auf die für die Pflegekraft relevanten Informationen: Tagesroute, Patienteninformationen, Leistungserfassung und Navigation. Alle Schaltflächen müssen für die Bedienung mit Handschuhen ausreichend groß dimensioniert sein.

### 10.4 Barrierefreiheit

Die Webanwendung muss die Anforderungen der **WCAG 2.1 Level AA** erfüllen, insbesondere ausreichende Farbkontraste (Kontrastverhältnis mindestens 4,5:1), vollständige Bedienbarkeit per Tastatur sowie kompatible Beschriftungen für Screenreader.

---

## 11. Testkonzept und Abnahmekriterien

### 11.1 Testphasen

Die Qualitätssicherung umfasst folgende Testphasen:

**Unit-Tests:** Automatisierte Tests aller Kernfunktionen, insbesondere des Optimierungsalgorithmus. Mindestens 80 % Code-Coverage ist nachzuweisen. **Integrationstests:** Überprüfung aller Schnittstellen (Kartendienst, TI, Abrechnungssysteme). **Systemtests:** End-to-End-Tests der vollständigen Planungsworkflows mit realistischen Testdaten. **Penetrationstest:** Unabhängiger Sicherheitstest durch einen zertifizierten IT-Sicherheitsdienstleister vor der Produktivnahme. **Pilotbetrieb:** Betrieb der Software in einem ausgewählten Pflegedienst über mindestens 4 Wochen vor dem Rollout.

### 11.2 Abnahmekriterien

Die Software gilt als abnahmereif, wenn alle nachfolgenden Kriterien erfüllt sind:

| Kriterium | Nachweis |
|---|---|
| Alle funktionalen Anforderungen aus Kapitel 5 sind implementiert | Abnahmeprotokoll mit Testfällen |
| Routenoptimierung liefert valide Ergebnisse unter allen definierten Restriktionen | Testprotokoll mit Benchmark-Szenarien |
| Keine offenen Sicherheitslücken mit Schweregrad "Hoch" oder "Kritisch" | Penetrationstest-Bericht |
| DSGVO-Konformität ist durch Datenschutz-Audit bestätigt | Auditbericht eines zertifizierten Datenschutzbeauftragten |
| TI-Kompatibilität ist technisch nachgewiesen | Zertifizierungsnachweis der gematik |
| Performance-Anforderungen (Kap. 6.1) sind erfüllt | Lasttest-Protokoll |
| Benutzerhandbuch und Schulungsunterlagen liegen vollständig vor | Dokumentationsabnahme |

---

## 12. Projektplanung und Meilensteine

| Meilenstein | Beschreibung | Geplantes Datum |
|---|---|---|
| **M1: Kickoff** | Projektstart, Abstimmung Anforderungen | Monat 1 |
| **M2: Architekturdesign** | Technische Architektur und Datenbankmodell abgenommen | Monat 2 |
| **M3: Prototyp** | Lauffähiger Prototyp der Kernfunktionen (Planung, Karte) | Monat 4 |
| **M4: Beta-Version** | Vollständige Funktionalität, interne Tests abgeschlossen | Monat 7 |
| **M5: Pilotbetrieb** | Betrieb in ausgewähltem Pflegedienst, Feedback-Phase | Monat 8–9 |
| **M6: Produktivnahme** | Offizieller Go-Live nach bestandener Abnahme | Monat 10 |
| **M7: TI-Integration** | Vollständige TI-Anbindung (KIM, eVO) abgeschlossen | Monat 12 |

---

## 13. Risiken und Gegenmaßnahmen

| Risiko | Wahrscheinlichkeit | Auswirkung | Gegenmaßnahme |
|---|---|---|---|
| Verzögerungen bei TI-Zertifizierung durch gematik | Mittel | Hoch | Frühzeitige Beantragung; Puffer im Zeitplan |
| Datenschutzverletzung durch Sicherheitslücke | Niedrig | Sehr hoch | Regelmäßige Penetrationstests; Bug-Bounty-Programm |
| Schlechte Nutzerakzeptanz durch Pflegekräfte | Mittel | Mittel | Frühzeitige Einbindung der Nutzer; intensive Schulungen |
| Abhängigkeit von externem Kartendienst-Anbieter | Mittel | Mittel | Vertragliche SLA-Absicherung; Fallback-Anbieter definieren |
| Unzureichende Performance des Optimierungsalgorithmus | Niedrig | Hoch | Frühzeitige Lasttests; Algorithmus-Benchmarking in Phase 1 |

---

## 14. Glossar

| Begriff | Definition |
|---|---|
| **AVV** | Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO |
| **DSGVO** | Datenschutz-Grundverordnung der Europäischen Union |
| **DTA** | Datenträgeraustausch; standardisiertes Format für die elektronische Abrechnung mit Kassen |
| **ePA** | Elektronische Patientenakte |
| **eVO** | Elektronische Verordnung |
| **gematik** | Gesellschaft für Telematikanwendungen der Gesundheitskarte mbH |
| **KIM** | Kommunikation im Medizinwesen; sicherer E-Mail-Dienst der TI |
| **PDL** | Pflegedienstleitung |
| **PWA** | Progressive Web App; Webanwendung mit nativer App-ähnlicher Funktionalität |
| **RBAC** | Role-Based Access Control; rollenbasiertes Berechtigungskonzept |
| **SaaS** | Software-as-a-Service; Cloud-basiertes Softwarebereitstellungsmodell |
| **SGB V** | Fünftes Sozialgesetzbuch (Gesetzliche Krankenversicherung) |
| **SGB XI** | Elftes Sozialgesetzbuch (Soziale Pflegeversicherung) |
| **SMC-B** | Security Module Card Typ B; Institutionskarte für die TI-Authentifizierung |
| **TI** | Telematikinfrastruktur; sicheres Netzwerk des deutschen Gesundheitswesens |
| **TOMs** | Technische und organisatorische Maßnahmen gemäß Art. 32 DSGVO |
| **VRP** | Vehicle Routing Problem; kombinatorisches Optimierungsproblem der Routenplanung |
| **VRPTW** | Vehicle Routing Problem with Time Windows; VRP-Variante mit Zeitfensterbeschränkungen |
| **WCAG** | Web Content Accessibility Guidelines; Richtlinien für barrierefreie Webinhalte |

---

## 15. Referenzen

[^1]: DMRZ (2025). *Telematikinfrastruktur (TI) in der Pflege*. Abgerufen von https://www.dmrz.de/wissen/ratgeber/telematikinfrastruktur-in-der-pflege

[^2]: Wawrik Pflege Consulting (2024). *Ambulante Tourenplanung: individuelle Planung vs. Vorgabezeiten*. Abgerufen von https://wawrik-pflege-consulting.de/ambulante-tourenplanung-individuelle-planung-vs-vorgabezeiten/

[^3]: SecureProof (2026). *Pflegesoftware & Datenschutz: DSGVO sicher umsetzen*. Abgerufen von https://secure-proof.de/pflegesoftware-datenschutz-worauf-ambulante-pflegedienste-bei-der-dsgvo-achten-sollten/

[^4]: Routecontrol (2025). *Tourenplanung in der ambulanten Pflege*. Abgerufen von https://routecontrol.de/2025/05/06/tourenplanung-ambulante-pflege/

[^5]: Famedly (2024). *Telematikinfrastruktur 2025: Checkliste für Pflegeeinrichtungen*. Abgerufen von https://www.famedly.com/blog/telematikinfrastruktur-pflegeeinrichtungen

---

*Dieses Dokument ist urheberrechtlich geschützt. Alle Rechte vorbehalten. Eine Weitergabe an Dritte bedarf der schriftlichen Zustimmung des Auftraggebers.*
