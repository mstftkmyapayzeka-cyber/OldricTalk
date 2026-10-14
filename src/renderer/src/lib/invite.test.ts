import { describe, expect, it } from 'vitest'
import { inviteLink, parseInvite } from './invite'

describe('parseInvite', () => {
  it('çıplak kodu kabul eder', () => {
    expect(parseInvite('  a1b2c3d4e5f6 ')).toBe('a1b2c3d4e5f6')
  })
  it('bağlantıdan kodu çıkarır', () => {
    expect(parseInvite(inviteLink('a1b2c3d4e5f6'))).toBe('a1b2c3d4e5f6')
    expect(parseInvite('https://ornek.com/davet/A1B2C3D4E5F6/')).toBe('a1b2c3d4e5f6')
  })
  it('geçersiz girdiyi reddeder', () => {
    expect(parseInvite('')).toBeNull()
    expect(parseInvite('merhaba dünya')).toBeNull()
    expect(parseInvite('xyz')).toBeNull()
  })
})
