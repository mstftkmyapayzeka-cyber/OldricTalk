import { describe, expect, it } from 'vitest'
import { cn, colorFor, formatBytes, initials } from './utils'

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

describe('formatBytes', () => {
  it('ondalık ayırıcı virgüldür', () => {
    expect(formatBytes(2.3 * 1024 * 1024)).toBe('2,3 MB')
    expect(formatBytes(1536)).toBe('1,5 KB')
  })
  it('tam sayıda ondalık yazmaz', () => {
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB')
  })
  it('küçük boyutu bayt olarak verir', () => {
    expect(formatBytes(512)).toBe('512 B')
  })
})

describe('colorFor', () => {
  it('kişiye altı avatar renginden birini sabit olarak verir', () => {
    expect(colorFor('ayse')).toMatch(/^hsl\(var\(--avatar-[1-6]\)\)$/)
    expect(colorFor('ayse')).toBe(colorFor('ayse'))
  })
})

describe('cn', () => {
  it('tasarım yazı boyutunu renk sınıfıyla birlikte korur', () => {
    expect(cn('text-label text-header')).toBe('text-label text-header')
  })
  it('çakışan yazı boyutlarında sonuncuyu tutar', () => {
    expect(cn('text-label', 'text-meta')).toBe('text-meta')
  })
})
