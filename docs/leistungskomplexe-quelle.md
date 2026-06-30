# Leistungskomplexe (LK) je Bundesland — Quelle & Pflegehinweise

Die LK-Kataloge in `src/shared/leistungskomplexe.ts` (`KATALOG_NACH_BUNDESLAND`)
sind **abrechnungsrelevant**. Sie stammen je Bundesland aus den
Vergütungsvereinbarungen / Landesrahmenverträgen (§ 89 SGB XI).

## Amtliche Gesamtquelle

Bundesministerium für Gesundheit (BMG) — „Übersicht über vereinbarte ambulante
Leistungskomplexe in den Bundesländern", **Stand 01.07.2021**, 24 Seiten,
enthält alle 16 Länder mit Nr., Bezeichnung und Durchschnittspreisen:

<https://www.bundesgesundheitsministerium.de/fileadmin/Dateien/3_Downloads/P/Pflegebericht/siebter_pflegebericht_anlage_7_ambulante_leistungskomplexe_bf.pdf>

## Wichtige Einschränkungen

- **Stand 01.07.2021** — Nummerierung, Zuschnitt und Punktwerte können sich seit­
  her geändert haben. Vor produktiver (Abrechnungs-)Nutzung gegen die **aktuelle**
  Landesvergütungsvereinbarung verifizieren.
- Die Ländertabellen sind **uneinheitlich aufgebaut**: integer-Codes (z. B. BW,
  Niedersachsen), 3-stellige Codes (Bayern: 201, 202 …), alphanumerische Codes
  (Schleswig-Holstein: P2, K1 …), teils mehrere Vereinbarungen je Land
  (Bayern: Wohlfahrt vs. privat; Rheinland-Pfalz: mehrere Modelle).
- Eine automatische Massen-Extraktion ist daher fehleranfällig; Einträge werden
  **manuell aus der Quelle verifiziert** je Land eingepflegt — bewusst nicht
  geraten.

## Status der Einpflege

- **Baden-Württemberg** — eingepflegt, verifiziert gegen die BMG-Tabelle 2021.
- **Übrige 15 Länder** — noch nicht eingepflegt; nutzen vorerst den
  vorläufigen Standard-Fallback (`LEISTUNGSKOMPLEXE`). Beim Einpflegen jeweils
  die zugehörige Seite der BMG-Quelle (oder die aktuelle Landesvereinbarung)
  zugrunde legen und in `KATALOG_NACH_BUNDESLAND` ergänzen.
