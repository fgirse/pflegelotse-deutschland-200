# Datenschutz-Umsetzung (2-Säulen-Modell)

Tourenoptimierungs- und Vermittlungsplattform (ambulante Pflege). Konkretisiert die
technische und organisatorische Umsetzung des Datenschutzes. Da Klientenadressen mit
Leistungsangaben verarbeitet werden, handelt es sich um **besondere Kategorien
personenbezogener Daten (Art. 9 DSGVO)** — das hebt die Anforderungen an Verschlüsselung und
Zugriffskontrolle an. Grundlage ist Privacy by Design (Art. 25): die physische und logische
Trennung in zwei Säulen.

**Die drei Collections:**

- `klienten_identitaet` — **Säule 1**, identifizierende Daten, CSFLE-verschlüsselt.
- `klienten_operativ` — **Säule 2**, pseudonymisierte Betriebsdaten, nur `pseudonym_id`.
- `gdpr_audit_log` — schreibgeschütztes WORM-Log (Write-Once-Read-Many).

---

## 1. Technische Schutzmaßnahmen (TOM, Art. 32)

Geordnet nach den Schutzzielen des Art. 32 DSGVO.

| Schutzziel | Maßnahme | Umsetzung |
|---|---|---|
| Vertraulichkeit | Verschlüsselung at rest | CSFLE (random) für alle Säule-1-Felder; WiredTiger Encryption-at-Rest |
| Vertraulichkeit | Verschlüsselung in transit | TLS 1.3 für alle Verbindungen |
| Vertraulichkeit | Pseudonymisierung | 2-Säulen-Trennung; Säule 2 referenziert nur UUIDv4 |
| Vertraulichkeit | Zugriffskontrolle (DB) | getrennte Service-Accounts pro Säule (Abschnitt unten) |
| Vertraulichkeit | Zugriffskontrolle (App) | rollenbasiert (RBAC), verpflichtende TOTP-2FA für Rollen mit Klientendatenzugriff |
| Vertraulichkeit | Schlüsseltrennung | Schlüssel liegen im KMS, nie auf dem DB-Server (Abschnitt 5) |
| Integrität | Eingabekontrolle | Schema-Validierung sperrt PII in Säule 2 (Abschnitt 2) |
| Integrität | Revisionssicherheit | WORM-Audit-Log, HMAC-gehasht, nur `insert`/`find` |
| Verfügbarkeit | Backup & Failover | Replica-Set, automatisierte Backups, getesteter Restore |
| Belastbarkeit | Trennungskontrolle | Mandanten- (`tenant_id`) und Säulen-Trennung |
| Datensparsamkeit | Minimierung | nur optimierungsrelevante Daten in Säule 2; keine PII in Logs/Cache/URLs |
| Überprüfbarkeit | Tests & Audits | automatisierte Datenschutz-Tests in CI; Pentest vor Go-Live; Dependency-Scanning |
| Organisatorisch | Hosting & Verträge | EU-Hosting; AVV mit allen Auftragsverarbeitern; VVT (Art. 30) |

---

## 2. PII-Sperre in Säule 2 (Schema-Validierung)

Zweite Verteidigungslinie neben der RBAC: Selbst wenn die Anwendung fehlerhaft PII schreiben
wollte, weist MongoDB den Schreibvorgang serverseitig ab. Der Validator erzwingt eine gültige
UUIDv4 als `pseudonym_id` und schließt identifizierende Felder explizit aus.

```javascript
db.createCollection("klienten_operativ", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["pseudonym_id", "tenant_id", "geo", "status"],
      properties: {
        pseudonym_id: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
          description: "Muss eine gültige kryptografische UUIDv4 sein."
        },
        tenant_id: { bsonType: "string" },
        geo: {
          bsonType: "object", required: ["lat", "lng"],
          properties: { lat: { bsonType: "double" }, lng: { bsonType: "double" } }
        },
        pflegegrad: { bsonType: "int", minimum: 1, maximum: 5 },
        leistungen: { bsonType: "array", items: { bsonType: "string" } },
        status: { enum: ["aktiv", "pausiert", "beendet"] },
        // PII-BLACKBOX: identifizierende Felder werden serverseitig abgewiesen
        vorname:  { not: { bsonType: ["string", "object", "array", "null"] } },
        nachname: { not: { bsonType: ["string", "object", "array", "null"] } },
        adresse:  { not: { bsonType: ["string", "object", "array", "null"] } },
        telefon:  { not: { bsonType: ["string", "object", "array", "null"] } }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});
```

Die getrennten Service-Accounts ergänzen das: Der Optimierungs-Worker nutzt `svc_operativ`
(nur Säule 2, kein `remove` = Revisionssicherheit) und kann Säule 1 technisch nicht lesen.

```javascript
db.getSiblingDB("admin").createRole({
  role: "operativRole",
  privileges: [{
    resource: { db: "pflege_prod", collection: "klienten_operativ" },
    actions: ["find", "insert", "update"]   // kein "remove"
  }],
  roles: []
});
```

---

## 3. Betroffenenrechte

### 3.1 Recht auf Löschung (Art. 17)

**Mechanismus: Crypto-Shredding.** Jeder Klient besitzt einen eigenen Data-Encryption-Key,
mit dem seine Säule-1-Felder verschlüsselt sind. Wird dieser Schlüssel gelöscht, sind die
identifizierenden Felder **sofort und unumkehrbar unlesbar — auch in Backups**. Die Daten in
Säule 2 werden damit zu echten Anonymisaten; aufwändige Kaskadenlöschungen entfallen.

Löschung und Audit-Eintrag laufen **atomar in einer ACID-Transaktion** — beide gelingen oder
beide scheitern:

```javascript
const session = db.getMongo().startSession();
session.startTransaction();
try {
  const identCol = session.getDatabase("pflege_prod").getCollection("klienten_identitaet");
  const auditCol = session.getDatabase("pflege_prod").getCollection("gdpr_audit_log");

  const res = identCol.deleteOne({ pseudonym_id: targetId });   // bzw. Data-Key vernichten
  if (res.deletedCount === 1) {
    auditCol.insertOne({
      timestamp: new Date(),
      request_type: "RIGHT_TO_BE_FORGOTTEN",
      identity_hash: hmacWithKmsPepper(klientKennung),   // kein Klarname im Log
      pepper_version: "2026-v1",
      former_pseudonym_id: targetId,
      status: "SUCCESS"
    });
    session.commitTransaction();
  } else {
    session.abortTransaction();
  }
} catch (e) { session.abortTransaction(); throw e; }
finally { session.endSession(); }
```

**Backup-Dilemma.** Klassische Backups enthalten gelöschte Sätze noch 30–90 Tage. Zwei
Schutzschichten: (a) Crypto-Shredding macht die Felder schon in Backups unlesbar; (b) eine
Tombstone-Liste, gegen die nach jedem Restore automatisch alle dokumentiert gelöschten
`pseudonym_ids` entfernt werden.

### 3.2 Recht auf Auskunft / Übertragbarkeit (Art. 15 / 20)

Zweistufige Abfrage über die Säulen, anschließend Aufbereitung als portables JSON. Die interne
`pseudonym_id` wird im Export ausgeblendet (der Betroffene soll seine System-ID nicht kennen).

```javascript
// 1. ID aus Säule 1
const klient = db.klienten_identitaet.findOne({ pseudonym_id: targetId });

// 2. Operative Daten aus Säule 2 (technische IDs ausblenden)
const operativ = db.klienten_operativ.find(
  { pseudonym_id: klient.pseudonym_id },
  { projection: { _id: 0, pseudonym_id: 0 } }
).toArray();
```

Export-Paket (maschinenlesbar nach Art. 20):

```json
{
  "datenauskunft_erstellt_am": "2026-06-23T10:00:00Z",
  "stammdaten_saeule_1": { "vorname": "...", "nachname": "...", "adresse": "..." },
  "operative_daten_saeule_2": [
    { "pflegegrad": 3, "leistungen": ["LK01","LK15"], "zeitfenster": [/* ... */] }
  ]
}
```

> Der Join über beide Säulen darf nur durch die eng begrenzte Gatekeeper-Rolle erfolgen, die
> Leserecht auf beide Collections hat — nicht durch den Standard-Operativ-Account.

---

## 4. Datenpannen (Art. 33)

Bei einer Verletzung läuft die **72-Stunden-Meldefrist**. Die Säulen-Trennung entscheidet
über die Meldepflicht:

**Szenario A — nur Säule 2 abgeflossen.** Die Daten enthalten ausschließlich kryptografische
`pseudonym_ids` ohne Zuordnungsmöglichkeit. Für den Angreifer ist kein Personenbezug
herstellbar → **keine Meldepflicht an die Aufsichtsbehörde**, nur interne Dokumentation.

**Szenario B — Säule 1 abgeflossen.** Meldepflichtige Datenpanne. Das WORM-Audit-Log liefert
den exakten Nachweis, welche Personen zum Zeitpunkt des Vorfalls bereits gelöscht bzw.
crypto-geshreddet waren. Bei voraussichtlich hohem Risiko ist zusätzlich Art. 34
(Benachrichtigung der Betroffenen) zu prüfen — bei Gesundheitsdaten ist diese Schwelle eher
erreicht.

**Argumentationslinie gegenüber der Behörde** (Privacy-by-Design nach Art. 25): Die
identifizierenden Stammdaten waren physisch und logisch von den operativen Daten getrennt; die
betroffene operative Datenbank enthielt nur pseudonymisierte UUIDv4; die Zuordnungssäule ist
durch ein schreibgeschütztes Audit-Log und hardwaregestützte Schlüsselrotation gesichert; ein
Rückschluss auf reale Personen ist nach Stand der Technik ausgeschlossen.

*(Konkrete Meldebewertung im Einzelfall mit Datenschutzbeauftragten/Fachjurist — keine
Rechtsberatung.)*

---

## 5. Schlüsselverwaltung und Rotation

**Aufbau.** Es gibt drei Schlüssel-Ebenen, alle außerhalb des DB-Servers:

- **Customer Master Key (CMK)** im KMS (AWS KMS `eu-central-1` oder HashiCorp Vault) —
  umschließt die Data-Encryption-Keys.
- **Data-Encryption-Keys (DEK)** pro Klient für CSFLE — ihre Vernichtung ist der
  Crypto-Shredding-Hebel (Art. 17).
- **Audit-Pepper** für die HMAC-Hashes im Log — verlässt den Vault nie im Klartext.

**Pepper via Vault Transit** (der Pepper bleibt im Vault):

```javascript
const response = await vault.write(`transit/hmac/${KEY_NAME}`, {
  input: Buffer.from(klientKennung).toString('base64'),
  algorithm: "sha2-256"
});
const hashToStore = response.data.hmac;   // "vault:v2:7a5e2b3c..."
```

Das Feld `pepper_version` im Log verweist auf die konkrete Schlüsselversion, damit alte Hashes
auch **nach Rotation** noch verifizierbar bleiben. Ohne externes KMS ist **Argon2id**
(memory-hard) die Fallback-Strategie — SHA-256 allein ist zu schnell und brute-force-anfällig.

**Automatisierte Rotation** (z. B. vierteljährlich per Cronjob); alte Versionen bleiben
schreibgeschützt erhalten:

```bash
#!/usr/bin/env bash
set -euo pipefail
KEY_NAME="gdpr-audit-pepper"
vault status > /dev/null || { echo "ERROR: Vault nicht erreichbar" >&2; exit 1; }
vault write -f "transit/keys/${KEY_NAME}/rotate"
NEW_VERSION=$(vault read -field latest_version "transit/keys/${KEY_NAME}")
echo "Schlüssel rotiert. Neue Version: v${NEW_VERSION}"
```

**Bedrohung und Abwehr im Überblick:**

| Bedrohung | Abwehr | Werkzeug |
|---|---|---|
| Diebstahl des Audit-Logs | Hash ohne Pepper wertlos | HMAC-SHA256 |
| Diebstahl des DB-Servers | Schlüssel liegt nicht auf dem Server | KMS / Vault |
| GPU-Brute-Force | Algorithmus verlangsamen | Argon2id |
| Langzeit-Kompromittierung | alte Hashes durch neue Schlüssel geschützt | Key Rotation |

---

## Querbezug

Diese Umsetzung macht das 2-Säulen-Prinzip (P3) konkret und erfüllt die TOM-Anforderungen aus
Art. 32 für Art-9-Daten. Sie ist die technische Grundlage, die im Test- und Abnahmekonzept
geprüft (Schwerpunkt Sicherheit/Datenschutz) und im Datenschutz-Gate (DSFA) vor Go-Live
abgenommen wird.
