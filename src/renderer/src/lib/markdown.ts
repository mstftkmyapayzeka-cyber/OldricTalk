// Mesaj biçimlendirmesi için küçük, güvenli ayrıştırıcı. HTML üretmez; bileşen
// düğümleri React öğelerine çevirir, böylece içerik asla HTML olarak yorumlanmaz.

export type MdNode =
  | { t: 'text'; v: string }
  | { t: 'bold' | 'italic' | 'strike'; c: MdNode[] }
  | { t: 'code'; v: string }
  | { t: 'codeblock'; v: string; lang: string }
  | { t: 'link'; href: string }
  | { t: 'mention'; username: string }
  | { t: 'br' }

const URL_RE = /^https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/
const MENTION_RE = /^@([a-z0-9_.]{2,32}|everyone)/

export function parseMarkdown(src: string): MdNode[] {
  const out: MdNode[] = []
  // Kod blokları önce ayrılır; içleri biçimlendirilmez.
  const parts = src.split(/```/)
  parts.forEach((part, i) => {
    if (i % 2 === 1 && i < parts.length - 1) {
      const nl = part.indexOf('\n')
      const first = nl === -1 ? '' : part.slice(0, nl).trim()
      const isLang = /^[a-z0-9+#-]{1,20}$/i.test(first)
      out.push({
        t: 'codeblock',
        lang: isLang ? first : '',
        v: (isLang ? part.slice(nl + 1) : part).replace(/^\n|\n$/g, '')
      })
    } else {
      // Kapanmamış ``` düz metin olarak kalır.
      const text = i % 2 === 1 ? '```' + part : part
      out.push(...parseInline(text))
    }
  })
  return merge(out)
}

function parseInline(s: string): MdNode[] {
  const out: MdNode[] = []
  let buf = ''
  const flush = (): void => {
    if (buf) out.push({ t: 'text', v: buf })
    buf = ''
  }
  let i = 0
  while (i < s.length) {
    const rest = s.slice(i)
    const ch = s[i]
    const prev = i === 0 ? ' ' : s[i - 1]

    if (ch === '\n') {
      flush()
      out.push({ t: 'br' })
      i++
      continue
    }
    if (ch === '\\' && i + 1 < s.length && '*_~`\\@'.includes(s[i + 1])) {
      buf += s[i + 1]
      i += 2
      continue
    }
    if (ch === '`') {
      const end = s.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ t: 'code', v: s.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    if (ch === 'h' && /\W|^$/.test(prev)) {
      const m = URL_RE.exec(rest)
      if (m) {
        flush()
        out.push({ t: 'link', href: m[0] })
        i += m[0].length
        continue
      }
    }
    if (ch === '@' && /\s|^$|[(]/.test(prev)) {
      const m = MENTION_RE.exec(rest)
      if (m) {
        flush()
        out.push({ t: 'mention', username: m[1] })
        i += m[0].length
        continue
      }
    }
    const span = matchSpan(s, i)
    if (span) {
      flush()
      out.push({ t: span.kind, c: parseInline(span.inner) })
      i = span.end
      continue
    }
    buf += ch
    i++
  }
  flush()
  return out
}

function matchSpan(
  s: string,
  i: number
): { kind: 'bold' | 'italic' | 'strike'; inner: string; end: number } | null {
  const tries: Array<[string, 'bold' | 'italic' | 'strike']> = [
    ['**', 'bold'],
    ['~~', 'strike'],
    ['*', 'italic'],
    ['_', 'italic']
  ]
  for (const [mark, kind] of tries) {
    if (!s.startsWith(mark, i)) continue
    const start = i + mark.length
    if (start >= s.length || /\s/.test(s[start])) continue
    let end = s.indexOf(mark, start)
    // Tek '*' ararken '**' ile karışmasın.
    while (mark === '*' && end !== -1 && s[end + 1] === '*') end = s.indexOf(mark, end + 2)
    if (end <= start || /\s/.test(s[end - 1])) continue
    if (s.slice(start, end).includes('\n')) continue
    // _italik_ yalnızca kelime sınırında (snake_case bozulmasın).
    if (mark === '_' && /\w/.test(s[end + 1] ?? '')) continue
    return { kind, inner: s.slice(start, end), end: end + mark.length }
  }
  return null
}

function merge(nodes: MdNode[]): MdNode[] {
  const out: MdNode[] = []
  for (const n of nodes) {
    const last = out[out.length - 1]
    if (n.t === 'text' && last?.t === 'text') last.v += n.v
    else out.push(n)
  }
  return out
}

/** Mesaj belirli bir kullanıcıyı (ya da @everyone ile herkesi) anıyor mu? */
export function mentions(content: string, username: string): boolean {
  const re = /(^|[\s(])@([a-z0-9_.]{2,32}|everyone)(?![a-z0-9_.])/g
  for (const m of content.matchAll(re)) {
    if (m[2] === username || m[2] === 'everyone') return true
  }
  return false
}
