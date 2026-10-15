import { useState } from 'react'
import { errorMessage } from '@/lib/errors'
import { Button } from './button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './dialog'
import { ErrorBox } from './input'

/** Onay penceresi; onConfirm hata fırlatırsa pencerede gösterilir. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Onayla',
  danger = true,
  confirmDisabled,
  onConfirm,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  danger?: boolean
  /** Ör. en yıkıcı işlemde sunucu adı yazılana kadar. */
  confirmDisabled?: boolean
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
      <DialogContent hideClose className="w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {description && (
            <DialogDescription asChild>
              <div className="mt-0 text-body text-text [&_b]:font-semibold [&_b]:text-header">
                {description}
              </div>
            </DialogDescription>
          )}
          {children}
          {error && <ErrorBox>{error}</ErrorBox>}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={busy || confirmDisabled} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
