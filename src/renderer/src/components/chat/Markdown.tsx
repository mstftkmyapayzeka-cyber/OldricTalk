import { Fragment, useMemo } from 'react'
import { parseMarkdown, type MdNode } from '@/lib/markdown'
import { cn } from '@/lib/utils'

function render(nodes: MdNode[], myUsername: string | undefined): React.ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return <Fragment key={i}>{n.v}</Fragment>
      case 'br':
        return <br key={i} />
      case 'bold':
        return <strong key={i}>{render(n.c, myUsername)}</strong>
      case 'italic':
        return <em key={i}>{render(n.c, myUsername)}</em>
      case 'strike':
        return <s key={i}>{render(n.c, myUsername)}</s>
      case 'code':
        return (
          <code key={i} className="rounded bg-floating px-1 py-0.5 font-mono text-[13px]">
            {n.v}
          </code>
        )
      case 'codeblock':
        return (
          <pre
            key={i}
            className="my-1 max-w-[90%] overflow-x-auto rounded border border-black/40 bg-sidebar p-2 font-mono text-[13px] leading-snug"
          >
            {n.v}
          </pre>
        )
      case 'link':
        return (
          <a
            key={i}
            href={n.href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[hsl(200_100%_65%)] hover:underline"
          >
            {n.href}
          </a>
        )
      case 'mention':
        return (
          <span
            key={i}
            className={cn(
              'rounded px-0.5 font-medium',
              n.username === myUsername || n.username === 'everyone'
                ? 'bg-brand/30 text-header'
                : 'bg-brand/15 text-[hsl(255_100%_85%)]'
            )}
          >
            @{n.username}
          </span>
        )
    }
  })
}

export default function Markdown({
  content,
  myUsername
}: {
  content: string
  myUsername?: string
}): React.JSX.Element {
  const nodes = useMemo(() => parseMarkdown(content), [content])
  return <>{render(nodes, myUsername)}</>
}
