 PflegeLotse-100

Generiere eine browserbasierte Software welche zur Tourenoptimierung von ambulanten Pflegediensten dient:

Die ökonomische Grundlogik
In der ambulanten Pflege fressen Wegezeiten die Marge – sie sind unbezahlte, unproduktive Zeit. Ein Klient, der geografisch und zeitlich in eine bestehende Tour passt, hat nahezu null Grenzkosten und ist damit fast reine Marge. Ein Klient, der einen Umweg erzwingt, kann sogar defizitär sein. Daraus folgt: Ein Dienst will nicht irgendeinen Klienten, sondern den passgenauen. Und für den ist seine Zahlungsbereitschaft hoch – nicht weil er einen Lead braucht, sondern weil du ihm konkrete Zusatzmarge auf eine ohnehin gefahrene Route lieferst.
Die Software soll genau für diese Person sein , die im Dienst täglich die Touren plant – meist die Pflegedienstleitung oder ein Disponent, der das heute in Excel, am Whiteboard oder mühsam in einer schwerfälligen Pflegesoftware macht.




This is a Next.js project using the App Router architecture, with Payload CMS
running natively inside it (Payload 3).

## Tech Stack
- Next.js (App Router) + React Server Components by default
- TypeScript (strict)
- Tailwind CSS v4 (frontend only; the Payload admin keeps its own styling)
- Payload CMS 3 (headless, MongoDB backend, localization on)
- MongoDB (Atlas / replica set — required for CSFLE + transactions)
- next-intl for UI localization (8 languages, German default)
- zod for validation and shared types
- Anthropic Claude API (server-side only) for the KI-Pflegelotse

## Package manager
- **pnpm** (not bun). Payload's tooling is pnpm-oriented; project settings live
  in `pnpm-workspace.yaml` (build approvals, `verifyDepsBeforeRun: false`).

## Project Structure
- `src/app/(frontend)/[locale]/` - localized public site (next-intl)
- `src/app/(payload)/` - Payload admin + API (owns `/admin`, `/api`)
- `src/app/api/v1/` - versioned application REST API (zod-validated)
- `src/collections/` - Payload collections (CMS + auth/RBAC)
- `src/server/` - service layer (identity, marketplace, matching, …)
- `src/db/` - Mongo connection, `$jsonSchema` validators, indexes
- `src/lib/` - env, crypto, encryption helpers
- `src/shared/` - zod schemas + inferred TS types (FE↔API single source)
- `src/i18n/` + `messages/` - localization config and catalogs
- `docs/PLAN.md` - the implementation plan
- `docs/` - weitere Pläne (Payment/Geschäftsmodell: siehe Abschnitt unten)

## Conventions
- Use Server Components by default, add 'use client' only when needed
- Prefer named exports for components
- Use TypeScript strict mode
- Follow the Next.js file-based routing conventions
- Use next/image for optimized images
- Use next/link for client-side navigation

## Code Style
- Use functional components with TypeScript
- Prefer async/await over .then() chains
- Use early returns for cleaner code
- Keep components small and focused

## Commands
- `pnpm run setup` - Create `.env`, generate secrets
- `pnpm run dev` - Start development server (http://localhost:3000)
- `pnpm run build` - Build for production
- `pnpm run lint` - Run ESLint
- `pnpm run typecheck` - TypeScript type check
- `pnpm run db:init` - Create collections, validators, indexes
- `pnpm run generate:types` - Regenerate Payload types after collection changes
- `pnpm test` - Integration (vitest) + e2e (Playwright) tests

## Privacy invariant (non-negotiable)
Two-pillar model: identity PII lives only in Säule 1 (`users_identity`, CSFLE);
Säule 2 collections are pseudonymous (UUIDv4 link only) and their `$jsonSchema`
validators actively reject PII fields. Never add name/email/phone/address to a
Säule 2 collection.

## Geschäftsmodell & Payment

Maßgeblicher Payment-Provider ist **Mollie** — implementiert in
`src/server/billing/` (u. a. `mollie.ts`, `subscription.ts`) und
`src/app/api/v1/billing/` (`checkout`, `webhook`, `status`); Env: `MOLLIE_API_KEY`.
Die Payment-Docs nennen historisch teils Stripe — das ist **nicht** der
implementierte Stack; gesetzt ist Mollie.

- `docs/implementierung-payment.md` — Strategie **und** detaillierte Umsetzung
  des Payment-Stacks: 4-Phasen-Roadmap (MVP/B2C-Einmal → B2B-Abo/SEPA →
  Pay-per-Lead/B2C-Abo → Enterprise) plus Meilensteine, Architektur, Risikomatrix
  und Budget; lesen bei Priorisierung/Roadmap und konkreter Payment-Implementierung.
- `docs/zahlungsmodell-praxis.md` — Zahlungsmodell in der Praxis: wer zahlt
  was/wann/wie, Tarife (B2B-SaaS, B2C-Premium, Werbung), Zahlungsmethoden, PSP;
  lesen bei Pricing-, Tarif- und Checkout-Fragen.
