import { useState } from 'react'
import { errorMessage } from '@/lib/errors'
import { Button } from './button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogTitle, DialogDescription } from './dialog'

/** Onay penceresi; onConfirm hata fırlatırsa pencerede gösterilir. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Onayla',
  danger = true,
  onConfirm,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => Promise<void> | void
  children?: React.ReactNode
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose>
        <DialogBody className="pt-5">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {description && <DialogDescription asChild><div>{description}</div></DialogDescription>}
          {children}
          {error && <p className="text-sm text-dnd">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="link" className="text-foreground" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
