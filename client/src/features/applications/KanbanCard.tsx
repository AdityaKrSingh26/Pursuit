import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Application } from '../../lib/types'
import { fmtDate, isPastDue } from '../../lib/format'

export default function KanbanCard({
  app,
  onOpen,
}: {
  app: Application
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: app.id,
    data: { stage: app.stage },
  })

  const due = app.nextActionAt
  const overdue = isPastDue(due)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`group relative border-[1.5px] border-line bg-paper-3 transition-shadow ${
        isDragging ? 'z-50 opacity-90 shadow-hard-lg' : 'shadow-hard-sm hover:shadow-hard'
      }`}
    >
      {/* Drag handle strip on the left edge keeps card body clickable. */}
      <button
        {...listeners}
        {...attributes}
        className="absolute inset-y-0 left-0 w-3 cursor-grab border-r border-line/40 bg-paper text-ink-faint active:cursor-grabbing"
        aria-label="Drag"
      >
        <span className="block text-center text-[8px] leading-none">⋮⋮</span>
      </button>

      <button onClick={onOpen} className="block w-full py-2.5 pl-5 pr-3 text-left">
        <p className="label">{app.company}</p>
        <p className="mt-0.5 font-display text-[15px] font-semibold leading-tight">
          {app.roleTitle}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {app.source && (
            <span className="border border-ink-faint/50 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-ink-faint">
              {app.source}
            </span>
          )}
          {due && (
            <span
              className={`px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${
                overdue
                  ? 'animate-blink border border-missing bg-missing/15 text-missing'
                  : 'border border-line text-ink-soft'
              }`}
            >
              {overdue ? '⚑ ' : '⌁ '}
              {fmtDate(due)}
            </span>
          )}
        </div>
      </button>
    </div>
  )
}
