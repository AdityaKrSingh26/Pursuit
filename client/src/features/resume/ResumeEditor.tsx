import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../../lib/api'
import type { ResumeBlock } from '../../lib/types'

const SECTIONS = ['EXPERIENCE', 'PROJECTS', 'SKILLS', 'EDUCATION']

function SortableBlock({
  block,
  onSave,
  onArchive,
}: {
  block: ResumeBlock
  onSave: (id: string, data: Partial<ResumeBlock>) => void
  onArchive: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(block.content)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(block.skillTags ?? [])

  function save() {
    onSave(block.id, { content, skillTags: tags })
    setEditing(false)
  }

  function addTag(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t))
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-3 flex gap-3 group"
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing mt-1 shrink-0"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <textarea
              className="w-full text-sm border rounded p-2 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
            {/* Tag input */}
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:text-red-500">×</button>
                </span>
              ))}
              <input
                className="text-xs border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                placeholder="Add tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={save} className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save</button>
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap">{block.content}</p>
            {block.skillTags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {block.skillTags.map((t: string) => (
                  <span key={t} className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!editing && (
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 shrink-0">
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">Edit</button>
          <button onClick={() => onArchive(block.id)} className="text-xs text-red-500 hover:underline">Archive</button>
        </div>
      )}
    </div>
  )
}

function AddBlockForm({ section, onAdd }: { section: string; onAdd: (data: Partial<ResumeBlock>) => void }) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')

  function submit() {
    if (!content.trim()) return
    onAdd({ section, content, skillTags: [], orderDefault: 999 })
    setContent('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-indigo-500 hover:underline mt-1"
      >
        + Add block175845
      </button>
    )
  }

  return (
    <div className="space-y-2 mt-2">
      <textarea
        className="w-full text-sm border rounded p-2 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        placeholder="Block content…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">Add</button>
        <button onClick={() => setOpen(false)} className="text-xs px-3 py-1 bg-gray-200 rounded">Cancel</button>
      </div>
    </div>
  )
}

export default function ResumeEditor() {
  const qc = useQueryClient()
  const [showArchived, setShowArchived] = useState(false)

  const { data: blocks = [], isLoading } = useQuery<ResumeBlock[]>({
    queryKey: ['resume-blocks'],
    queryFn: () => api<ResumeBlock[]>('/resume/blocks'),
  })

  const { data: archivedBlocks = [] } = useQuery<ResumeBlock[]>({
    queryKey: ['resume-blocks-archived'],
    queryFn: () =>
      api<ResumeBlock[]>('/resume/blocks?archived=true').catch(() => [] as ResumeBlock[]),
    enabled: showArchived,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ResumeBlock> }) =>
      api(`/resume/blocks/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resume-blocks'] }),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api(`/resume/blocks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resume-blocks'] }),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<ResumeBlock>) =>
      api('/resume/blocks', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resume-blocks'] }),
  })

  const reorderMutation = useMutation({
    mutationFn: (updates: { id: string; orderDefault: number }[]) =>
      api('/resume/blocks/reorder', { method: 'POST', body: { updates } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resume-blocks'] }),
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sectionRef = useRef<Record<string, ResumeBlock[]>>({})

  function handleDragEnd(event: DragEndEvent, section: string) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const sectionBlocks = sectionRef.current[section] ?? []
    const oldIdx = sectionBlocks.findIndex((b) => b.id === active.id)
    const newIdx = sectionBlocks.findIndex((b) => b.id === over.id)
    const reordered = arrayMove(sectionBlocks, oldIdx, newIdx)
    const updates = reordered.map((b, i) => ({ id: b.id, orderDefault: i }))
    reorderMutation.mutate(updates)
  }

  if (isLoading) return <div className="p-8 text-gray-400">Loading resume blocks…</div>

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Resume</h1>
        <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Show archived
        </label>
      </div>

      {SECTIONS.map((section) => {
        const sectionBlocks = blocks.filter((b) => b.section?.toUpperCase() === section)
        sectionRef.current[section] = sectionBlocks
        return (
          <div key={section}>
            <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
              {section}
            </h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, section)}
            >
              <SortableContext
                items={sectionBlocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {sectionBlocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      onSave={(id, data) => updateMutation.mutate({ id, data })}
                      onArchive={(id) => archiveMutation.mutate(id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <AddBlockForm
              section={section}
              onAdd={(data) => createMutation.mutate(data)}
            />
          </div>
        )
      })}

      {showArchived && archivedBlocks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Archived</h2>
          <div className="space-y-2 opacity-50">
            {archivedBlocks.map((block) => (
              <div key={block.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500">
                <span className="text-xs text-gray-400 uppercase mr-2">{block.section}</span>
                {block.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
