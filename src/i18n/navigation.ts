import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// Locale-bewusste Navigations-Helfer (Link, redirect, usePathname, …).
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
