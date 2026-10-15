import { useEffect, useRef } from 'react'
import { Smile } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { useTheme } from '@/stores/theme'
import { Tooltip } from '@/components/ui/tooltip'

// emoji-mart renkleri tasarım belirteçlerinden (brand, floating, text, input, border) RGB olarak.
const PICKER_VARS: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    '--rgb-accent': '168, 60, 11',
    '--rgb-background': '255, 255, 255',
    '--rgb-color': '67, 54, 45',
    '--rgb-input': '247, 245, 242',
    '--color-border': 'rgba(209, 198, 189, 1)',
    '--color-border-over': 'rgba(209, 198, 189, 1)'
  },
  dark: {
    '--rgb-accent': '246, 131, 49',
    '--rgb-background': '55, 47, 42',
    '--rgb-color': '223, 216, 211',
    '--rgb-input': '26, 22, 20',
    '--color-border': 'rgba(81, 72, 67, 1)',
    '--color-border-over': 'rgba(81, 72, 67, 1)'
  }
}

// emoji-mart'ın React sarmalayıcısı React 19'u desteklemediğinden çekirdek Picker
// (web bileşeni) doğrudan kullanılır; veriler ilk açılışta tembel yüklenir.
function PickerMount({ onSelect }: { onSelect: (emoji: string) => void }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const theme = useTheme((s) => s.theme)

  useEffect(() => {
    let cancelled = false
    const host = ref.current
    void (async () => {
      const [{ Picker }, data, i18n] = await Promise.all([
        import('emoji-mart'),
        import('@emoji-mart/data').then((m) => m.default),
        import('@emoji-mart/data/i18n/tr.json').then((m) => m.default)
      ])
      if (cancelled || !host) return
      const picker = new Picker({
        data,
        i18n,
        theme,
        previewPosition: 'none',
        skinTonePosition: 'search',
        onEmojiSelect: (e: { native: string }) => onSelectRef.current(e.native)
      }) as unknown as HTMLElement
      for (const [k, v] of Object.entries(PICKER_VARS[theme])) picker.style.setProperty(k, v)
      picker.style.setProperty('--font-family', 'var(--font-sans)')
      picker.style.setProperty('--border-radius', '12px')
      picker.style.setProperty('--shadow', 'none')
      host.replaceChildren(picker)
    })()
    return () => {
      cancelled = true
      host?.replaceChildren()
    }
  }, [theme])

  return <div ref={ref} className="min-h-[435px] min-w-[352px]" />
}

export default function EmojiPicker({
  onSelect
}: {
  onSelect: (emoji: string) => void
}): React.JSX.Element {
  return (
    <Popover.Root>
      <Tooltip label="Emoji">
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Emoji"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-muted transition-colors duration-fast hover:bg-hover hover:text-header data-[state=open]:bg-hover data-[state=open]:text-header"
          >
            <Smile className="h-[18px] w-[18px]" />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-50 overflow-hidden rounded-lg border border-border bg-floating shadow-md animate-fade-in"
        >
          <PickerMount onSelect={onSelect} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
