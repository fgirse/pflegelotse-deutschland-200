// Reiner CSV-Parser ohne DB-/Server-Abhängigkeiten (eigenständig testbar).
// Erkennt das Trennzeichen (Semikolon/Komma/Tab — deutsches Excel nutzt „;"),
// entfernt das BOM und versteht in Anführungszeichen eingefasste Felder (mit
// eingebetteten Trennzeichen, Zeilenumbrüchen und „" als Quote-Escape).
export interface CsvDaten {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsv(text: string): CsvDaten {
  const s = text.replace(/^﻿/, '')
  if (!s.trim()) return { headers: [], rows: [] }

  const umbruch = s.search(/\r?\n/)
  const ersteZeile = umbruch >= 0 ? s.slice(0, umbruch) : s
  const delim = erkenneTrenner(ersteZeile)

  const records = parseRecords(s, delim)
  if (records.length === 0) return { headers: [], rows: [] }

  const headers = records[0].map((h) => h.trim())
  const rows = records
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? '').trim()
      })
      return obj
    })
  return { headers, rows }
}

function erkenneTrenner(zeile: string): string {
  let best = ';'
  let max = -1
  for (const d of [';', ',', '\t']) {
    const n = zeile.split(d).length
    if (n > max) {
      max = n
      best = d
    }
  }
  return best
}

function parseRecords(s: string, delim: string): string[][] {
  const records: string[][] = []
  let feld = ''
  let zeile: string[] = []
  let inQuotes = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          feld += '"'
          i++
        } else inQuotes = false
      } else feld += c
    } else if (c === '"') inQuotes = true
    else if (c === delim) {
      zeile.push(feld)
      feld = ''
    } else if (c === '\n') {
      zeile.push(feld)
      records.push(zeile)
      zeile = []
      feld = ''
    } else if (c === '\r') {
      // ignorieren — das \n schließt die Zeile ab
    } else feld += c
  }
  if (feld !== '' || zeile.length > 0) {
    zeile.push(feld)
    records.push(zeile)
  }
  return records
}
