import { describe, expect, it } from 'vitest'
import { mentions, parseMarkdown } from './markdown'

describe('parseMarkdown', () => {
  it('düz metni olduğu gibi bırakır', () => {
    expect(parseMarkdown('merhaba dünya')).toEqual([{ t: 'text', v: 'merhaba dünya' }])
  })

  it('HTML etiketlerini metin olarak tutar', () => {
    expect(parseMarkdown('<img src=x onerror=alert(1)>')).toEqual([
      { t: 'text', v: '<img src=x onerror=alert(1)>' }
    ])
  })

  it('kalın, italik ve üstü çiziliyi ayırır', () => {
    expect(parseMarkdown('**a** *b* ~~c~~')).toEqual([
      { t: 'bold', c: [{ t: 'text', v: 'a' }] },
      { t: 'text', v: ' ' },
      { t: 'italic', c: [{ t: 'text', v: 'b' }] },
      { t: 'text', v: ' ' },
      { t: 'strike', c: [{ t: 'text', v: 'c' }] }
    ])
  })

  it('snake_case adlarını italiğe çevirmez', () => {
    expect(parseMarkdown('my_var_name')).toEqual([{ t: 'text', v: 'my_var_name' }])
  })

  it('satır içi kodun içini biçimlendirmez', () => {
    expect(parseMarkdown('`**x**`')).toEqual([{ t: 'code', v: '**x**' }])
  })

  it('dil etiketli kod bloğunu ayırır', () => {
    expect(parseMarkdown('önce\n```ts\nconst a = 1\n```\nsonra')).toEqual([
      { t: 'text', v: 'önce' },
      { t: 'br' },
      { t: 'codeblock', lang: 'ts', v: 'const a = 1' },
      { t: 'br' },
      { t: 'text', v: 'sonra' }
    ])
  })

  it('kapanmamış kod bloğunu metin bırakır', () => {
    expect(parseMarkdown('```yarım')).toEqual([{ t: 'text', v: '```yarım' }])
  })

  it('bağlantıları ve sondaki noktalamayı ayırır', () => {
    expect(parseMarkdown('bak: https://ornek.com/a?b=1.')).toEqual([
      { t: 'text', v: 'bak: ' },
      { t: 'link', href: 'https://ornek.com/a?b=1' },
      { t: 'text', v: '.' }
    ])
  })

  it('javascript: bağlantısı üretmez', () => {
    expect(parseMarkdown('javascript:alert(1)')).toEqual([
      { t: 'text', v: 'javascript:alert(1)' }
    ])
  })

  it('anmaları ayırır, e-posta adresini anma saymaz', () => {
    expect(parseMarkdown('@ali selam, ali@ornek.com')).toEqual([
      { t: 'mention', username: 'ali' },
      { t: 'text', v: ' selam, ali@ornek.com' }
    ])
  })

  it('kaçış karakterine uyar', () => {
    expect(parseMarkdown('\\*yıldız\\*')).toEqual([{ t: 'text', v: '*yıldız*' }])
  })
})

describe('mentions', () => {
  it('kullanıcı adını ve @everyone’ı tanır', () => {
    expect(mentions('selam @ali', 'ali')).toBe(true)
    expect(mentions('@everyone toplantı', 'ali')).toBe(true)
    expect(mentions('selam @alican', 'ali')).toBe(false)
    expect(mentions('ali@ornek.com', 'ali')).toBe(false)
  })
})
