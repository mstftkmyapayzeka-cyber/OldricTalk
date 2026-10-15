import { useEffect, useMemo, useRef } from 'react'
import { Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Resim seçici (sunucu simgesi / avatar); yükleme kaydederken yapılır.
 * Boşken 96px kesikli daire + "YÜKLE"; resim varsa üzerine gelince "DEĞİŞTİR".
 * fallback: resim yokken boş kutu yerine gösterilecek içerik (ör. baş harfler).
 */
export default function ImagePicker({
  file,
  currentUrl,
  onPick,
  label = 'YÜKLE',
  shape = 'circle',
  fallback,
  ariaLabel = 'Resim yükle',
  className
}: {
  file: File | null
  currentUrl?: string | null
  onPick: (f: File) => void
  label?: string
  shape?: 'circle' | 'rounded'
  fallback?: React.ReactNode
  ariaLabel?: string
  className?: string
}): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  const src = preview ?? currentUrl
  const filled = !!src || !!fallback

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => ref.current?.click()}
      className={cn(
        'group relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden transition-colors duration-fast',
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        !filled && 'border-2 border-dashed border-border-strong bg-input text-text-muted hover:border-brand hover:text-brand',
        className
      )}
    >
      {filled ? (
        <>
          {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : fallback}
          <span className="absolute inset-0 grid place-items-center bg-black/50 text-tiny tracking-[0.06em] text-white opacity-0 transition-opacity duration-fast group-hover:opacity-100">
            DEĞİŞTİR
          </span>
        </>
      ) : (
        <span className="flex flex-col items-center gap-0.5">
          <Camera className="h-6 w-6" />
          <span className="text-tiny tracking-[0.06em]">{label}</span>
        </span>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''
        }}
      />
    </button>
  )
}
