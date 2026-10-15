import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { Button, EmptyState, Spinner } from '../../components/ui'
import { STAGES } from '../../lib/stages'
import { useKanbanColumns, usePatchApplication } from '../../lib/queries'
import { moveApplicationAcrossStageLists } from '../../lib/kanbanBoard'
import type { Application, ListApplicationsResponse, Stage } from '../../lib/types'
import KanbanCard from './KanbanCard'
import AddApplicationModal from './AddApplicationModal'
import DetailDrawer from './DetailDrawer'

function Column({
  stage,
  apps,
  swatch,
  label,
  onOpen,
}: {
  stage: Stage
  apps: Application[]
  swatch: string
  label: string
  onOpen: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between border-b-[1.5px] border-line pb-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5" style={{ backgroundColor: swatch }} />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">{label}</span>
        </div>
        <span className="font-mono text-[11px] text-ink-faint">{apps.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[120px] flex-1 flex-col gap-2 border-[1.5px] border-dashed p-2 transition-colors ${
          isOver ? 'border-signal bg-signal/5' : 'border-transparent'
        }`}
      >
        {apps.map((app) => (
          <KanbanCard key={app.id} app={app} onOpen={() => onOpen(app.id)} />
        ))}
      </div>
    </div>
  )
}

export default function KanbanPage() {
  const qc = useQueryClient()
  const columnQueries = useKanbanColumns()
  const patch = usePatchApplication()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const isLoading = columnQueries.some((q) => q.isLoading)
  const byStage = Object.fromEntries(
    STAGES.map((s, i) => [s.code, columnQueries[i].data?.items ?? []]),
  ) as Record<Stage, Application[]>
  const total = STAGES.reduce((n, s) => n + byStage[s.code].length, 0)
  const activeApp =
    STAGES.map((s) => byStage[s.code].find((a) => a.id === activeId)).find(Boolean) ?? null

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const id = String(e.active.id)
    const from = e.active.data.current?.stage as Stage | undefined
    const to = e.over?.id as Stage | undefined
    if (!to || !from || from === to) return

    const next = moveApplicationAcrossStageLists(byStage, id, from, to)
    for (const s of STAGES) {
      qc.setQueryData<ListApplicationsResponse>(
        ['applications', { stages: [s.code] }],
        (old) =>
          old
            ? { ...old, items: next[s.code] ?? [] }
            : { items: next[s.code] ?? [], nextCursor: null },
      )
    }
    patch.mutate({ id, patch: { stage: to } })
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        index="01"
        title="Pipeline"
        subtitle="Drag a card to move it through the funnel."
        actions={<Button variant="signal" onClick={() => setAdding(true)}>+ Add application</Button>}
      />

      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-ink-soft">
            <Spinner /> <span className="font-mono text-xs">Loading pipeline…</span>
          </div>
        ) : total === 0 ? (
          <EmptyState
            title="No applications yet"
            hint="Add your first role to start tracking the hunt. Paste a URL or the raw JD and the pipeline takes it from there."
          />
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="flex gap-4 pb-4">
              {STAGES.map((s) => (
                <Column
                  key={s.code}
                  stage={s.code}
                  label={s.label}
                  swatch={s.swatch}
                  apps={byStage[s.code]}
                  onOpen={setOpenId}
                />
              ))}
            </div>
            <DragOverlay>
              {activeApp && (
                <div className="w-60 border-[1.5px] border-line bg-paper-3 py-2.5 pl-5 pr-3 shadow-hard-lg">
                  <p className="label">{activeApp.company}</p>
                  <p className="mt-0.5 font-display text-[15px] font-semibold leading-tight">
                    {activeApp.roleTitle}
                  </p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {adding && <AddApplicationModal onClose={() => setAdding(false)} />}
      {openId && <DetailDrawer id={openId} onClose={() => setOpenId(null)} onSelectApp={(id) => setOpenId(id)} />}
    </div>
  )
}
