import type { ReactNode } from 'react'

export default function PageHeader({
  index,
  title,
  subtitle,
  actions,
}: {
  index: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex items-end justify-between gap-4 border-b-[1.5px] border-line bg-paper px-8 py-5">
      <div>
        <span className="label">FILE {index}</span>
        <h1 className="mt-1 font-display text-3xl font-black leading-none tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
