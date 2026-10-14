import { useTyping } from '@/stores/typing'

export default function TypingIndicator({ targetId }: { targetId: string }): React.JSX.Element {
  const users = useTyping((s) => s.byTarget[targetId])
  const names = users ? Object.values(users).map((u) => u.name) : []

  let text = ''
  if (names.length === 1) text = `${names[0]} yazıyor…`
  else if (names.length === 2) text = `${names[0]} ve ${names[1]} yazıyor…`
  else if (names.length === 3) text = `${names[0]}, ${names[1]} ve ${names[2]} yazıyor…`
  else if (names.length > 3) text = 'Birkaç kişi yazıyor…'

  return (
    <div className="flex h-6 items-center gap-1.5 px-4 text-xs text-foreground">
      {text && (
        <>
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
          <span className="truncate font-medium">{text}</span>
        </>
      )}
    </div>
  )
}
