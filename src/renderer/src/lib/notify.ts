// Windows bildirimleri (Electron'da HTML5 Notification yerel bildirime dönüşür).

export function notify(opts: {
  title: string
  body: string
  icon?: string | null
  onClick?: () => void
}): void {
  window.oldric?.flashFrame()
  if (typeof Notification === 'undefined' || Notification.permission === 'denied') return
  const n = new Notification(opts.title, {
    body: opts.body.length > 180 ? opts.body.slice(0, 177) + '…' : opts.body,
    icon: opts.icon ?? undefined
  })
  n.onclick = () => {
    window.oldric?.focusWindow()
    opts.onClick?.()
  }
}

export function previewText(content: string, fileName: string | null): string {
  if (content.trim()) return content.replace(/```[\s\S]*?```/g, '[kod]')
  return fileName ? `📎 ${fileName}` : ''
}
