import { useEffect, useRef } from 'react'
import { Smile } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'

// emoji-mart'ın React sarmalayıcısı React 19'u desteklemediğinden çekirdek Picker
// (web bileşeni) doğrudan kullanılır; veriler ilk açılışta tembel yüklenir.
function PickerMount({ onSelect }: { onSelect: (emoji: string) => void }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

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
        theme: 'dark',
        previewPosition: 'none',
        skinTonePosition: 'search',
        onEmojiSelect: (e: { native: string }) => onSelectRef.current(e.native)
      })
      host.replaceChildren(picker as unknown as Node)
    })()
    return () => {
      cancelled = true
      host?.replaceChildren()
    }
  }, [])

  return <div ref={ref} className="min-h-[435px] min-w-[352px]" />
}

export default function EmojiPicker({
  onSelect
}: {
  onSelect: (emoji: string) => void
}): React.JSX.Element {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition hover:scale-110 hover:text-header"
          aria-label="Emoji"
        >
          <Smile className="h-6 w-6" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="end" sideOffset={12} className="z-50">
          <PickerMount onSelect={onSelect} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
