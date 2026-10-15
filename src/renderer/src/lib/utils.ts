import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Tasarım sistemindeki yazı boyutları (text-label, text-meta…) renk sınıflarıyla
// karıştırılmasın diye tailwind-merge'e tanıtılır; yoksa cn('text-label text-header')
// boyutu siler.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['title-lg', 'title-md', 'title-sm', 'body', 'label', 'meta', 'overline', 'tiny'] }
      ],
      shadow: [{ shadow: ['brand'] }]
    }
  }
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function initials(name: string): string {
  // Yalnızca harf/rakamla başlayan kelimeler: "Ayşe (test)" → "AT"
  const parts = name
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr')
  return (parts[0][0] + parts[1][0]).toLocaleUpperCase('tr')
}

/** Türkçe biçim: ondalık ayırıcı virgül ("2,3 MB"); tam sayılarda ondalık yazılmaz ("25 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  const text = kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`
  return text.replace('.0 ', ' ').replace('.', ',')
}

/** Kişi renkleri avatar-1…avatar-6; kimlikten türetilir ve değişmez. Üzerine on-avatar yazılır. */
export function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return `hsl(var(--avatar-${(h % 6) + 1}))`
}
