import { defineRouting } from 'next-intl/routing'

// Startsprachen dieses Baus: Deutsch (Default) + Englisch als Gerüst.
// Das Pflichtenheft sieht später DE, EN, TR, RU, UK, PL, AR vor (/F810/).
export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
})

export type Locale = (typeof routing.locales)[number]
