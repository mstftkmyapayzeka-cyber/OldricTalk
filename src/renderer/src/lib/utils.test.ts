import { describe, expect, it } from 'vitest'
import { initials } from './utils'

describe('initials', () => {
  it('iki kelimenin baş harflerini alır', () => {
    expect(initials('Ayşe Yılmaz')).toBe('AY')
  })
  it('noktalama işaretlerini atlar', () => {
    expect(initials('Ayşe (test)')).toBe('AT')
  })
  it('tek kelimede ilk iki harfi büyük harfle verir', () => {
    expect(initials('ıspanak')).toBe('IS')
  })
  it('boş adda soru işareti döner', () => {
    expect(initials('  ')).toBe('?')
  })
})
