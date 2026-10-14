import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileText, PlusCircle, X } from 'lucide-react'
import { sendMessage } from '@/lib/actions'
import { errorMessage } from '@/lib/errors'
import { sendTyping } from '@/lib/realtime'
import { isImage, uploadFile } from '@/lib/upload'
import { formatBytes } from '@/lib/utils'
import { LIMITS } from '@/lib/config'
import type { ChatTarget, ProfileLite } from '@/lib/types'
import { Spinner } from '@/components/ui/spinner'
import EmojiPicker from './EmojiPicker'

export type ComposerHandle = { attach: (file: File) => void; focus: () => void }

type Props = {
  target: ChatTarget
  me: ProfileLite
  placeholder: string
  disabledReason?: string | null
}

const TYPING_EVERY_MS = 3000

const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { target, me, placeholder, disabledReason },
  ref
) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastTyping = useRef(0)

  const topic = target.kind === 'channel' ? `server:${target.serverId}` : `dm:${target.id}`

  const preview = useMemo(
    () => (file && isImage(file.type) ? URL.createObjectURL(file) : null),
    [file]
  )
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  function attach(f: File): void {
    if (f.size > LIMITS.attachmentBytes) {
      setError(`Dosya çok büyük (en fazla ${formatBytes(LIMITS.attachmentBytes)}).`)
      return
    }
    setError(null)
    setFile(f)
    inputRef.current?.focus()
  }

  useImperativeHandle(ref, () => ({ attach, focus: () => inputRef.current?.focus() }))

  function onType(value: string): void {
    setText(value)
    setError(null)
    const now = Date.now()
    if (value && now - lastTyping.current > TYPING_EVERY_MS) {
      lastTyping.current = now
      sendTyping(topic, { target_id: target.id, user_id: me.id, name: me.display_name })
    }
  }

  async function submit(): Promise<void> {
    const content = text.trim()
    if ((!content && !file) || busy) return
    if (content.length > LIMITS.messageLength) {
      setError(`Mesaj en fazla ${LIMITS.messageLength} karakter olabilir.`)
      return
    }
    setBusy(true)
    setError(null)
    const keepText = text
    const keepFile = file
    setText('')
    setFile(null)
    lastTyping.current = 0
    sendTyping(topic, { target_id: target.id, user_id: me.id, name: me.display_name, stop: true })
    try {
      const uploaded = keepFile ? await uploadFile('attachments', keepFile, me.id) : undefined
      await sendMessage(qc, target, me, content, uploaded)
    } catch (e) {
      setText(keepText)
      setFile(keepFile)
      setError(errorMessage(e))
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  if (disabledReason) {
    return (
      <div className="px-4 pb-6">
        <div className="rounded-lg bg-input px-4 py-3 text-muted-foreground">{disabledReason}</div>
      </div>
    )
  }

  return (
    <div className="px-4">
      {error && <p className="mb-1 text-sm text-dnd">{error}</p>}
      <div className="rounded-lg bg-input">
        {file && (
          <div className="flex gap-2 border-b border-border p-3">
            <div className="relative flex w-[200px] flex-col gap-2 rounded-md bg-sidebar p-2">
              {preview ? (
                <img src={preview} alt="" className="h-[140px] w-full rounded object-contain" />
              ) : (
                <div className="flex h-[140px] items-center justify-center">
                  <FileText className="h-14 w-14 text-brand" />
                </div>
              )}
              <div className="truncate text-sm">{file.name}</div>
              <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
              <button
                onClick={() => setFile(null)}
                className="absolute -right-2 -top-2 rounded-md bg-chat p-1 text-dnd shadow hover:bg-hover"
                aria-label="Eki kaldır"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <div className="flex items-start gap-1 px-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-[11px] text-muted-foreground hover:text-header"
            aria-label="Dosya ekle"
          >
            <PlusCircle className="h-6 w-6" />
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) attach(f)
              e.target.value = ''
            }}
          />
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void submit()
              }
            }}
            onPaste={(e) => {
              const f = Array.from(e.clipboardData.files)[0]
              if (f) {
                e.preventDefault()
                attach(f)
              }
            }}
            placeholder={placeholder}
            rows={1}
            maxLength={LIMITS.messageLength + 100}
            className="max-h-[50vh] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-[11px] leading-[1.375rem] text-foreground placeholder:text-muted-foreground focus:outline-none [field-sizing:content]"
            autoFocus
          />
          <div className="mt-[6px] flex items-center gap-1">
            {busy && <Spinner className="h-4 w-4" />}
            <EmojiPicker
              onSelect={(emoji) => {
                const el = inputRef.current
                const pos = el?.selectionStart ?? text.length
                onType(text.slice(0, pos) + emoji + text.slice(pos))
                requestAnimationFrame(() => {
                  el?.focus()
                  el?.setSelectionRange(pos + emoji.length, pos + emoji.length)
                })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

export default Composer
