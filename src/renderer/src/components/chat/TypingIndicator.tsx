import { useTyping } from '@/stores/typing'

/** Mesaj kutusunun üstündeki "Ayşe yazıyor…" satırı (24px; boşken de yer tutar). */
export default function TypingIndicator({ targetId }: { targetId: string }): React.JSX.Element {
  const users = useTyping((s) => s.byTarget[targetId])
  const names = users ? Object.values(users).map((u) => u.name) : []

  let who: React.ReactNode = null
  if (names.length === 1) who = <><b>{names[0]}</b> yazıyor…</>
  else if (names.length === 2) who = <><b>{names[0]}</b> ve <b>{names[1]}</b> yazıyor…</>
  else if (names.length === 3)
    who = <><b>{names[0]}</b>, <b>{names[1]}</b> ve <b>{names[2]}</b> yazıyor…</>
  else if (names.length > 3) who = 'Birkaç kişi yazıyor…'

  return (
    <div aria-live="polite" className="flex h-6 items-center gap-2 text-meta text-text-muted">
      {who && (
        <>
          <span className="inline-flex gap-[3px]" aria-hidden>
            {[0, 1, 2].map((i) => (
              <i
                key={i}
                className="h-1 w-1 animate-typing-dot rounded-full bg-text-muted"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
          <span className="truncate [&_b]:font-semibold [&_b]:text-text">{who}</span>
        </>
      )}
    </div>
  )
}
