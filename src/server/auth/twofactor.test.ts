import { describe, it, expect } from 'vitest'
import { sign2fa, verify2fa, TWOFA_TTL_MS } from './twofactor'

describe('2FA-Session-Cookie', () => {
  it('akzeptiert ein frisch signiertes Cookie für denselben Nutzer', () => {
    const token = sign2fa('user-1', 1000)
    expect(verify2fa(token, 'user-1', 1000)).toBe(true)
  })

  it('lehnt ein Cookie für einen anderen Nutzer ab', () => {
    const token = sign2fa('user-1', 1000)
    expect(verify2fa(token, 'user-2', 1000)).toBe(false)
  })

  it('lehnt ein abgelaufenes Cookie ab', () => {
    const token = sign2fa('user-1', 1000)
    expect(verify2fa(token, 'user-1', 1000 + TWOFA_TTL_MS + 1)).toBe(false)
  })

  it('lehnt ein manipuliertes Cookie ab', () => {
    const token = sign2fa('user-1', 1000)
    const manipuliert = token.slice(0, -2) + (token.endsWith('00') ? '11' : '00')
    expect(verify2fa(manipuliert, 'user-1', 1000)).toBe(false)
  })

  it('lehnt Müll ab', () => {
    expect(verify2fa('abc', 'user-1', 1000)).toBe(false)
    expect(verify2fa(undefined, 'user-1', 1000)).toBe(false)
  })
})
