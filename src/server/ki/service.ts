import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { SYSTEM_PROMPT } from './systemPrompt'
import { sucheLeistungen } from './leistungskatalog'
import { bedarfEntwurfSchema, type BedarfEntwurf, type KiNachricht } from '@/shared/ki'

// Anthropic-Client (serverseitig; liest ANTHROPIC_API_KEY aus der Umgebung).
let client: Anthropic | undefined
export function getClient(): Anthropic {
  if (!client) {
    if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY fehlt')
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  }
  return client
}

// Tool-Definitionen (rohes JSON-Schema — kein Zod-v4-Helfer nötig). /F620/.
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'leistungen_nachschlagen',
    description:
      'Schlägt standardisierte Leistungskomplexe (LK-Codes) zu einem Stichwort nach, ' +
      'z. B. "waschen", "medikamente", "einkaufen".',
    input_schema: {
      type: 'object',
      properties: { stichwort: { type: 'string', description: 'Suchbegriff, z. B. "duschen"' } },
      required: ['stichwort'],
    },
  },
  {
    name: 'bedarf_vorschlag',
    description:
      'Erstellt einen strukturierten Bedarfsentwurf, sobald genug Informationen vorliegen. ' +
      'Enthält KEINE Kontaktdaten. Zeiten als "HH:MM".',
    input_schema: {
      type: 'object',
      properties: {
        ort: { type: 'string', description: 'Stadtteil/Ort, keine genaue Adresse' },
        pflegegrad: { type: 'integer', minimum: 1, maximum: 5 },
        leistungen: { type: 'array', items: { type: 'string' }, description: 'LK-Codes' },
        qualifikation: { type: 'array', items: { type: 'string' } },
        zeitVon: { type: 'string' },
        zeitBis: { type: 'string' },
        dauerMin: { type: 'integer' },
        express: { type: 'boolean' },
      },
      required: ['leistungen'],
    },
  },
]

const MAX_RUNDEN = 6 // Schutz gegen Endlosschleifen

// Führt einen Lotsen-Turn aus: manuelle Tool-Use-Schleife. Liefert die Antwort
// und — falls erstellt — den strukturierten Bedarfsentwurf.
export async function frageLotsen(
  nachrichten: KiNachricht[],
): Promise<{ antwort: string; entwurf?: BedarfEntwurf }> {
  const c = getClient()
  let entwurf: BedarfEntwurf | undefined
  const messages: Anthropic.MessageParam[] = nachrichten.map((n) => ({
    role: n.role,
    content: n.content,
  }))

  for (let runde = 0; runde < MAX_RUNDEN; runde++) {
    const resp = await c.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    })

    if (resp.stop_reason !== 'tool_use') {
      const antwort = textAus(resp.content)
      return { antwort: antwort || 'Wie kann ich dir bei der Pflegesuche helfen?', entwurf }
    }

    // Tool-Aufrufe ausführen und Ergebnisse zurückgeben.
    messages.push({ role: 'assistant', content: resp.content })
    const ergebnisse: Anthropic.ToolResultBlockParam[] = []
    for (const block of resp.content) {
      if (block.type !== 'tool_use') continue
      ergebnisse.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: fuehreToolAus(block, (e) => (entwurf = e)),
      })
    }
    messages.push({ role: 'user', content: ergebnisse })
  }

  // Rundenlimit erreicht — letzte Antwort bestmöglich zurückgeben.
  return { antwort: 'Lass uns das in kleineren Schritten klären — was ist dir am wichtigsten?', entwurf }
}

// Führt einen einzelnen Tool-Aufruf aus und liefert den Ergebnistext.
function fuehreToolAus(
  block: Anthropic.ToolUseBlock,
  setzeEntwurf: (e: BedarfEntwurf) => void,
): string {
  if (block.name === 'leistungen_nachschlagen') {
    const stichwort = String((block.input as { stichwort?: string }).stichwort ?? '')
    const treffer = sucheLeistungen(stichwort)
    if (treffer.length === 0) return `Keine Leistung zu "${stichwort}" gefunden.`
    return treffer.map((t) => `${t.code}: ${t.bezeichnung} (${t.qualifikation})`).join('\n')
  }
  if (block.name === 'bedarf_vorschlag') {
    const parsed = bedarfEntwurfSchema.safeParse(block.input)
    if (!parsed.success) return 'Entwurf unvollständig — bitte fehlende Angaben ergänzen.'
    setzeEntwurf(parsed.data)
    return 'Bedarfsentwurf gespeichert und der Angehörigen angezeigt.'
  }
  return `Unbekanntes Werkzeug: ${block.name}`
}

function textAus(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}
