// Reiner CSV-Schreiber (§8.3). Quotet Felder mit Trennzeichen, Anführungszeichen
// oder Zeilenumbruch (RFC-4180: Anführungszeichen werden verdoppelt). Zeilen mit
// CRLF getrennt — sowohl DATEV als auch Excel erwarten das.
function feld(wert: string, sep: string): string {
  if (wert.includes(sep) || wert.includes('"') || wert.includes('\n') || wert.includes('\r')) {
    return `"${wert.replace(/"/g, '""')}"`
  }
  return wert
}

export function schreibeCsv(zeilen: string[][], sep = ';'): string {
  return zeilen.map((z) => z.map((f) => feld(f, sep)).join(sep)).join('\r\n')
}

// Euro-Betrag im deutschen Format (Komma-Dezimal, 2 Stellen, kein Tausenderpunkt).
export function euro(betrag: number): string {
  return betrag.toFixed(2).replace('.', ',')
}
