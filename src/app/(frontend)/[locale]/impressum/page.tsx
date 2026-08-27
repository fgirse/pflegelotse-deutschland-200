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

      {/* Der Hinweis bleibt stehen, solange Pflichtangaben fehlen: Für eine
          GmbH sind Registergericht und Registernummer nach § 5 Abs. 1 Nr. 4 DDG
          vorgeschrieben. Sobald sie eingetragen sind, kann dieser Block weg. */}
      <div className="card mt-4 border-l-4 border-l-[var(--color-accent)] p-4 text-sm text-[var(--color-muted)]">
        Hinweis: Es fehlen noch die Registerangaben (Amtsgericht und
        HRB-Nummer). Sie sind für eine GmbH gesetzlich vorgeschrieben. Vor der
        Veröffentlichung bitte ergänzen und das Impressum rechtlich prüfen
        lassen.
      </div>

      <div className="mt-6 flex flex-col gap-6 leading-relaxed text-[var(--color-ink)]">
        <section>
          <h2 className="font-display text-lg font-semibold">Angaben gemäß § 5 DDG</h2>
          <p className="mt-2 text-[var(--color-muted)]">
            Pflegelotse Deutschland GmbH
            <br />
            Staufener Straße 79
            <br />
            79189 Bad Krozingen
            <br />
            Deutschland
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Vertreten durch</h2>
          <p className="mt-2 text-[var(--color-muted)]">
            Geschäftsführer: Michael Schreck
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Kontakt</h2>
          <p className="mt-2 text-[var(--color-muted)]">
            E-Mail:{' '}
            <a
              href="mailto:info@pflegelotse-deutschland.gmx.de"
              className="text-[var(--color-accent)] hover:underline"
            >
              info@pflegelotse-deutschland.gmx.de
            </a>
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Registereintrag</h2>
          <p className="mt-2 text-[var(--color-muted)]">
            Registergericht: [Amtsgericht …]
            <br />
            Registernummer: [HRB …]
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
