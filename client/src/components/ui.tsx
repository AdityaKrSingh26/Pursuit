import { useEffect, type ReactNode } from 'react'
import { stageMeta } from '../lib/stages'
import type { Stage } from '../lib/types'

export function Button({
  children,
  variant = 'default',
  className = '',
  ...props
}: {
  children: ReactNode
  variant?: 'default' | 'signal' | 'ghost'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'inline-flex items-center justify-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] font-medium disabled:opacity-40 disabled:pointer-events-none select-none'
  const styles =
    variant === 'signal'
      ? 'press bg-signal text-paper-3 hover:bg-signal'
      : variant === 'ghost'
        ? 'border-[1.5px] border-transparent text-ink-soft hover:text-ink hover:border-line'
        : 'press text-ink'
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function StageBadge({ stage, size = 'sm' }: { stage: Stage; size?: 'sm' | 'md' }) {
  const m = stageMeta(stage)
  const pad = size === 'md' ? 'px-2.5 py-1 text-[10.5px]' : 'px-2 py-0.5 text-[9.5px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 border border-line font-mono uppercase tracking-[0.14em] ${pad}`}
      style={{ backgroundColor: m.swatch + '22' }}
    >
      <span className="h-1.5 w-1.5" style={{ backgroundColor: m.swatch }} />
      {m.label}
    </span>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-faint border-t-signal ${className}`}
      aria-hidden
    />
  )
}

export function Tag({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-block border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
      style={color ? { backgroundColor: color + '1f', borderColor: color } : undefined}
    >
      {children}
    </span>
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 p-4 backdrop-blur-[2px] sm:p-10"
      onMouseDown={onClose}
    >
      <div
        className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} animate-rise-in border-[1.5px] border-line bg-paper-2 shadow-hard-lg`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b-[1.5px] border-line bg-paper px-5 py-3">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="font-mono text-lg leading-none text-ink-soft hover:text-signal"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border-[1.5px] border-dashed border-ink-faint bg-paper-2/50 px-6 py-14 text-center">
      <p className="font-display text-lg text-ink-soft">{title}</p>
      {hint && <p className="max-w-sm text-sm text-ink-faint">{hint}</p>}
    </div>
  )
}
