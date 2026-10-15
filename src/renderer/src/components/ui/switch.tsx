import { cn } from '@/lib/utils'

/** 42×24 anahtar; açıkken online, kapalıyken border-strong. Topuzun konumu da değişir. */
export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-[42px] shrink-0 rounded-pill transition-[background-color,filter] duration-base hover:brightness-110',
        checked ? 'bg-online' : 'bg-border-strong'
      )}
    >
      <span
        className={cn(
          'absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-floating shadow-sm transition-transform duration-base',
          checked && 'translate-x-[18px]'
        )}
      />
    </button>
  )
}

/**
 * Ayar satırı: başlık + bir cümlelik açıklama + sağda anahtar. Satırlar arası border çizgisi.
 * children: anahtarın ortaya çıkardığı denetim (ör. eşik kaydırıcısı) aynı satırın altında.
 */
export function SwitchRow({
  title,
  desc,
  checked,
  onChange,
  children
}: {
  title: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-4 border-t border-border py-3 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-semibold leading-5 text-header">{title}</span>
        <span className="mt-0.5 text-meta leading-[17px] text-text-muted">{desc}</span>
        {children && <div className="mt-3">{children}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  )
}
