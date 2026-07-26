# TI-Anbindung (§8.2) — Umsetzungsstand & Grenze

## Grundsatz
Eine *vollständige* Telematikinfrastruktur-Anbindung ist ohne zertifiziertes
Umfeld nicht herstellbar. Diese Umsetzung liefert die **Software-Seite** (Ports,
Datenmodell, fachliche Verarbeitung) und lässt den **Transport** als klar
markierte Naht offen — dort klinkt sich später der zertifizierte Client ein.

## Was der Auftraggeber stellt (nicht Teil der Software)
- **Konnektor** bzw. TI-Gateway (TI 2.0), **SMC-B**-Karte (Institutionsausweis),
  Zertifikate, gegenseitiges TLS.
- Gematik-**zugelassene Fachdienste**: KIM-Fachdienst, ePA-Aktensystem.
- **Zulassung/Konformitätstest** der Gesamtlösung.
- Env-Platzhalter dafür: `TI_KONNEKTOR_URL`, `TI_SMCB_ID`, `TI_KIM_ADRESSE`.

## Was hier real umgesetzt ist
- **Port-Schicht** `src/server/ti/ports.ts`: `EvoEingang`, `KimVersand`, `EpaLesen`
  (Ports & Adapters — austauschbar wie Routing/Notifier). Stubs in `stubs.ts`.
- **eVerordnung eingehend (substanziell)**: vereinfachtes, fachlich korrektes
  JSON-Schema `evo.ts`; reiner Mapper `mappeEvo()` mit **Zwei-Säulen-Trennung**
  (Patient-PII → Säule 1, verordnete Leistungen/Zeitraum → Säule 2). Service
  `verarbeiteEvo()`: idempotent über `verordnungId`, Geocoding der Adresse,
  Anlage von Identität + operativem Klienten + Verordnungs-Aufzeichnung, plus
  KIM-Rückmeldung (Stub). Endpoint `POST /api/v1/ti/evo`.
- Collection `verordnungen` (Säule 2, append-only, kein PII).

## Bewusst NICHT enthalten (Folgeschritte)
- Echter Konnektor-/SMC-B-/TLS-Aufbau, gematik-Zulassung.
- **KBV-FHIR-Vollprofil** der eVO (hier vereinfachtes JSON; FHIR-Mapping offen).
- **KIM** vollständig (S/MIME über TI, Adressierung) — nur Port + Stub.
- **ePA**-Lesezugriff (VSDM, Einwilligung, Aktensystem) — nur Port + Stub.
- Patienten-Deduplizierung über die Versichertennummer (heute wird je eVO ein
  Klient angelegt; die KVNR wird als `externalId` bereits mitgeführt).
