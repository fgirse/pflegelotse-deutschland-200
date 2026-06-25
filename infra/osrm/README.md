# Eigener OSRM-Routing-Server

Echtes Straßenrouting für den Fit-Score von PflegeLotse — auf eigener
Infrastruktur statt über den öffentlichen Demo-Server (der hat Limits und keine
Verfügbarkeitsgarantie). Die App nutzt den Server, sobald
`ROUTING_PROVIDER=osrm` und `OSRM_BASE_URL` gesetzt sind; fällt OSRM aus,
greift automatisch der Haversine-Fallback.

## Was passiert hier

OSRM arbeitet in zwei Phasen:

1. **Vorverarbeitung** (einmalig, schwer): aus einem OpenStreetMap-Extrakt
   (`.osm.pbf`) wird ein Routing-Graph gebaut — `osrm-extract` →
   `osrm-partition` → `osrm-customize` (MLD-Pipeline). Das übernimmt
   `prepare.sh`.
2. **Bedienung** (dauerhaft, leicht): `osrm-routed` lädt den Graphen und
   beantwortet Anfragen über HTTP. Das übernimmt `docker-compose.yml`.

## Voraussetzungen

- Docker + Docker Compose v2.
- **Arbeitsspeicher**: Der teure Schritt ist `osrm-extract`.
  - Deutschland (`germany-latest`, PBF ~4 GB): rechne mit **~16–24 GB RAM** und
    **~30 GB freiem Speicher** für die Graph-Dateien.
  - Baden-Württemberg (`baden-wuerttemberg-latest`, PBF ~1,5 GB): kommt mit
    **~6–8 GB RAM** aus — für einen regionalen Piloten (Region Freiburg) die
    pragmatische Wahl.

## Schnellstart

Vom Projekt-Root aus (Convenience-Skripte in `package.json`):

```bash
# 1) Graph bauen — Deutschland (Standard):
pnpm run osrm:prepare

#    …oder nur Baden-Württemberg (deutlich leichter):
PBF_URL=https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf \
  pnpm run osrm:prepare

# 2) Server starten:
pnpm run osrm:up

# 3) Funktion prüfen (Route Freiburg-intern):
curl 'http://localhost:5000/route/v1/driving/7.85,48.0;7.86,48.01'

# Stoppen:
pnpm run osrm:down
```

`prepare.sh` lädt den Extrakt nach `infra/osrm/data/`, baut den Graphen und
trägt `OSRM_DATA` in `infra/osrm/.env` ein (von Compose gelesen).

## Anbindung an die App

In den Environment-Variablen der App (lokal `.env`, in Produktion z. B. Vercel):

```
ROUTING_PROVIDER=osrm
OSRM_BASE_URL=http://localhost:5000      # bzw. http://<server-ip>:5000
OSRM_PROFILE=driving
```

Hinweise:

- `OSRM_PROFILE=driving` ist für einen Server mit einem einzigen Profil nur ein
  Pfadsegment in der URL und kann so bleiben, egal welches Lua-Profil beim
  Extrahieren genutzt wurde.
- **Vercel erreicht `localhost` nicht.** Für den produktiven Betrieb muss der
  OSRM-Server öffentlich erreichbar sein (eigener Host/VM mit fester IP oder
  Domain) und sollte hinter TLS + Zugriffsschutz stehen — `osrm-routed` bringt
  selbst keine Authentifizierung mit. Setze `OSRM_BASE_URL` dann auf diese
  öffentliche Adresse.

## Karte aktualisieren

Geofabrik veröffentlicht täglich neue Extrakte. Zum Aktualisieren `prepare.sh`
erneut laufen lassen (die alte `.osm.pbf` in `infra/osrm/data/` vorher löschen,
damit neu geladen wird) und den Server mit `osrm:down`/`osrm:up` neu starten.

## Profil wechseln (z. B. Fahrrad)

```bash
OSRM_LUA_PROFILE=/opt/bicycle.lua \
PBF_URL=https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf \
  pnpm run osrm:prepare
```
