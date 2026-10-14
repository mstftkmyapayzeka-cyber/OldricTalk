import { useEffect, useState } from 'react'
import { Monitor, AppWindow } from 'lucide-react'
import type { ScreenSource } from '../../../../shared/ipc'
import { startScreenShare } from '@/lib/voice'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

/** Paylaşılacak ekran/pencere seçimi (Windows'ta Chromium'un yerleşik seçicisi yok). */
export default function ScreenPicker({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [sources, setSources] = useState<ScreenSource[] | null>(null)
  const [kind, setKind] = useState<'screen' | 'window'>('screen')
  const [selected, setSelected] = useState<string | null>(null)
  const [audio, setAudio] = useState(false)

  useEffect(() => {
    void window.oldric?.screenSources().then((list) => {
      setSources(list)
      setSelected(list.find((s) => s.kind === 'screen')?.id ?? list[0]?.id ?? null)
    })
  }, [])

  async function share(): Promise<void> {
    if (!selected) return
    await window.oldric?.selectScreen(selected, audio)
    onClose()
    await startScreenShare(audio)
  }

  const shown = sources?.filter((s) => s.kind === kind) ?? []

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">Ekran Paylaş</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 px-4">
          {(
            [
              ['screen', 'Ekranlar', Monitor],
              ['window', 'Uygulamalar', AppWindow]
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium',
                kind === k ? 'bg-selected text-header' : 'text-muted-foreground hover:bg-hover'
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <DialogBody className="thin-scroll max-h-[420px] overflow-y-auto">
          {!sources ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : shown.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Paylaşılabilecek bir şey bulunamadı.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {shown.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  onDoubleClick={() => void share()}
                  className={cn(
                    'overflow-hidden rounded-lg border-2 bg-sidebar text-left transition',
                    selected === s.id ? 'border-brand' : 'border-transparent hover:border-border'
                  )}
                >
                  <img src={s.thumbnail} alt="" className="aspect-video w-full bg-black object-contain" />
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs">
                    {s.icon && <img src={s.icon} alt="" className="h-4 w-4" />}
                    <span className="truncate">{s.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter className="justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} />
            Bilgisayar sesini de paylaş
          </label>
          <div className="flex gap-2">
            <Button variant="link" className="text-foreground" onClick={onClose}>
              İptal
            </Button>
            <Button disabled={!selected} onClick={() => void share()}>
              Yayına Başla
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
