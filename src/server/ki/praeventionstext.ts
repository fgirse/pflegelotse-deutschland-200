import type Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { getClient } from './service'
import type { Empfehlung } from '@/shared/praevention'

// KI-Formulierungshilfe (/F940/): formuliert aus den (von der Pflegekraft
// bestätigten) Empfehlungen einen kurzen Begründungstext für die Pflegekasse.
// Die KI bewertet NICHTS fachlich und entscheidet nicht — sie formuliert nur;
// die Pflegekraft prüft und finalisiert. Keine PII im Prompt.
const SYSTEM = `Du formulierst für eine Pflegefachkraft einen kurzen, sachlichen Begründungstext
zu bereits ausgewählten Präventionsangeboten (§20 SGB V) für die Pflegekasse.
Strikt: Du triffst KEINE fachliche oder medizinische Bewertung, stellst keine Diagnose und
schlägst keine zusätzlichen Angebote vor. Du formulierst ausschließlich die bereits gewählten
Punkte aus. 3–5 Sätze, sachlich, deutsch. Keine personenbezogenen Daten verwenden.`

export async function formulierePraeventionstext(empfehlungen: Empfehlung[]): Promise<string> {
  const liste = empfehlungen
    .map((e) => `- ${e.titel} (${e.paragraf20}): ${e.begruendung}`)
    .join('\n')
  const resp = await getClient().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 512,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Formuliere einen Begründungstext zu folgenden gewählten Angeboten:\n${liste}`,
      },
    ],
  })
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}
