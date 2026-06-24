// Erstellt eine .env aus .env.example und füllt fehlende Secrets mit
// kryptografisch zufälligen Werten. Idempotent: vorhandene Werte bleiben.
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const examplePath = join(root, '.env.example')
const envPath = join(root, '.env')

const example = readFileSync(examplePath, 'utf8')
// Bestehende .env einlesen, damit gesetzte Werte erhalten bleiben.
const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
const existingMap = new Map(
  existing
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1)]
    }),
)

// Secrets, die wir bei Bedarf generieren.
const generated = {
  PAYLOAD_SECRET: () => randomBytes(32).toString('hex'),
  ENCRYPTION_MASTER_KEY: () => randomBytes(32).toString('base64'),
  AUDIT_PEPPER: () => randomBytes(32).toString('hex'),
}

const out = example
  .split('\n')
  .map((line) => {
    if (!line.includes('=') || line.trim().startsWith('#')) return line
    const i = line.indexOf('=')
    const key = line.slice(0, i).trim()
    const defaultVal = line.slice(i + 1)
    // Vorhandenen Wert bevorzugen.
    if (existingMap.get(key)) return `${key}=${existingMap.get(key)}`
    // Leere Secrets generieren.
    if (!defaultVal && generated[key]) return `${key}=${generated[key]()}`
    return line
  })
  .join('\n')

writeFileSync(envPath, out)
console.log('.env geschrieben. Secrets generiert, vorhandene Werte beibehalten.')
