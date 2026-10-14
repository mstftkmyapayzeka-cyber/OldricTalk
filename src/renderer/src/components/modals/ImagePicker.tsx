import { useEffect, useMemo, useRef } from 'react'
import { Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Yuvarlak resim seçici (sunucu simgesi / avatar). Yükleme kaydederken yapılır. */
export default function ImagePicker({
  file,
  currentUrl,
  onPick,
  label = 'YÜKLE',
  className
}: {
  file: File | null
  currentUrl?: string | null
  onPick: (f: File) => void
  label?: string
  className?: string
}): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  const src = preview ?? currentUrl

  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className={cn(
        'relative mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full',
        src ? '' : 'border-2 border-dashed border-muted-foreground text-muted-foreground',
        className
      )}
    >
      {src ? (
        <>
          <img src={src} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-bold text-white opacity-0 transition hover:opacity-100">
            DEĞİŞTİR
          </span>
        </>
      ) : (
        <span className="flex flex-col items-center gap-0.5 text-[10px] font-bold">
          <Camera className="h-6 w-6" />
          {label}
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
