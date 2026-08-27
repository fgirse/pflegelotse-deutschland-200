import { setRequestLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

// Impressum nach § 5 DDG (ehem. § 5 TMG). VORLAGE — Platzhalter [...] ausfüllen
// und vor Veröffentlichung prüfen lassen.
export default async function ImpressumPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container-page max-w-2xl py-10 sm:py-14">
      <span className="eyebrow">Rechtliches</span>
      <h1 className="mt-2 text-3xl font-bold">Impressum</h1>

      <div className="card mt-4 border-l-4 border-l-[var(--color-accent)] p-4 text-sm text-[var(--color-muted)]">
        Hinweis: Vorlage. Bitte die Platzhalter <code>[…]</code> mit euren echten
        Angaben ausfüllen und vor Veröffentlichung rechtlich prüfen lassen.
      </div>

      <div className="mt-6 flex flex-col gap-6 leading-relaxed text-[var(--color-ink)]">
        <section>
          <h2 className="font-display text-lg font-semibold">Angaben gemäß § 5 DDG</h2>
          <p className="mt-2 text-[var(--color-muted)]">
            [Name des Betreibers / Firma]
            <br />
            [Straße und Hausnummer]
            <br />
            [PLZ Ort]
            <br />
            [Land]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Vertreten durch</h2>
          <p className="mt-2 text-[var(--color-muted)]">[Vertretungsberechtigte Person]</p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Kontakt</h2>
          <p className="mt-2 text-[var(--color-muted)]">
            E-Mail: [kontakt@deine-domain.de]
            <br />
            Telefon: [+49 …]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Registereintrag (falls vorhanden)</h2>
          <p className="mt-2 text-[var(--color-muted)]">
            Registergericht: […]
            <br />
            Registernummer: […]
            <br />
            Umsatzsteuer-ID gemäß § 27a UStG: […]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">
            Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
          </h2>
          <p className="mt-2 text-[var(--color-muted)]">
            [Name]
            <br />
            [Anschrift]
          </p>
        </section>

        {/* Der frühere Verweis auf die EU-Plattform zur Online-Streitbeilegung
            (OS/ODR) ist entfallen: Sie wurde zum 20.07.2025 eingestellt und die
            zugrundeliegende Verordnung (EU) 524/2013 durch (EU) 2024/3228
            aufgehoben. Ein Link darauf wäre heute irreführend. Der Hinweis nach
            § 36 VSBG bleibt. */}
        <section>
          <h2 className="font-display text-lg font-semibold">
            Verbraucherstreitbeilegung
          </h2>
          <p className="mt-2 text-[var(--color-muted)]">
            Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren
            vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
          </p>
        </section>
      </div>
    </main>
  )
}
