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
        return <strong key={i} className="font-semibold">{render(n.c, myUsername)}</strong>
      case 'italic':
        return <em key={i}>{render(n.c, myUsername)}</em>
      case 'strike':
        return <s key={i}>{render(n.c, myUsername)}</s>
      case 'code':
        return (
          <code
            key={i}
            className="rounded-xs border border-border bg-input px-[5px] py-px font-mono text-[13px] leading-[19px]"
          >
            {n.v}
          </code>
        )
      case 'codeblock':
        return (
          <pre
            key={i}
            className="my-1 max-w-[90%] overflow-x-auto rounded-md border border-border bg-input px-3 py-2 font-mono text-[13px] leading-[19px] text-text"
          >
            {n.v}
          </pre>
        )
      case 'link':
        return (
          <a key={i} href={n.href} target="_blank" rel="noreferrer noopener" className="text-link hover:underline">
            {n.href}
          </a>
        )
      case 'mention':
        // Bahsetme: brand-soft zemin + brand metin; beni anan bahsetme bir ton koyu.
        return (
          <span
            key={i}
            className={cn(
              'rounded-xs px-[3px] font-semibold',
              n.username === myUsername || n.username === 'everyone'
                ? 'bg-brand text-on-brand'
                : 'bg-brand-soft text-brand'
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
