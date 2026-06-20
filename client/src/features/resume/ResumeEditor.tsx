import { useState } from 'react'
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
import { Button } from '../../components/ui'
import type {
  ResumeBlock,
  SectionContent,
  ExperienceContent,
  ProjectContent,
  SkillsContent,
  EducationContent,
} from '../../lib/types'
import { parseBlockContent, serializeBlockContent, defaultContent } from '../../lib/types'

const SECTIONS = ['EXPERIENCE', 'PROJECTS', 'SKILLS', 'EDUCATION']

const SECTION_LABELS: Record<string, string> = {
  EXPERIENCE: 'Experience',
  PROJECTS: 'Projects',
  SKILLS: 'Skills',
  EDUCATION: 'Education',
}

// ─── Shared form primitives ──────────────────────────────────────────────────

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="label mb-1 block">{label}</label>
      <input
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function BulletList({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="label mb-1 block">Bullet Points</label>
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-1.5 items-start">
          <span className="text-ink-faint mt-2.5 text-xs shrink-0">•</span>
          <textarea
            className="field flex-1 resize-none"
            value={b}
            rows={1}
            placeholder="Add a bullet point…"
            onChange={(e) => {
              const next = [...bullets]
              next[i] = e.target.value
              onChange(next)
            }}
          />
          {bullets.length > 1 && (
            <button
              onClick={() => onChange(bullets.filter((_, idx) => idx !== i))}
              className="text-ink-faint hover:text-signal mt-2 shrink-0 text-base leading-none"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => onChange([...bullets, ''])}
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:text-signal"
      >
        + Add bullet
      </button>
    </div>
  )
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')

  function handleKey(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      if (!tags.includes(input.trim())) onChange([...tags, input.trim()])
      setInput('')
    }
  }

  return (
    <div>
      <label className="label mb-1 block">Skill Tags</label>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 border border-line font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
          >
            {t}
            <button
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="hover:text-signal leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="field"
        placeholder="Type tag, press Enter or comma…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
      />
    </div>
  )
}

// ─── Section-specific edit forms ─────────────────────────────────────────────

function ExperienceForm({
  data,
  onChange,
}: {
  data: ExperienceContent
  onChange: (d: ExperienceContent) => void
}) {
  const u = (k: keyof ExperienceContent, v: string | string[]) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Company" value={data.company} onChange={(v) => u('company', v)} placeholder="Google" />
        <LabeledInput label="Role / Title" value={data.role} onChange={(v) => u('role', v)} placeholder="Software Engineer" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <LabeledInput label="Start Date" value={data.startDate} onChange={(v) => u('startDate', v)} placeholder="Jan 2022" />
        <LabeledInput label="End Date" value={data.endDate} onChange={(v) => u('endDate', v)} placeholder="Present" />
        <LabeledInput label="Location" value={data.location} onChange={(v) => u('location', v)} placeholder="New York, NY" />
      </div>
      <BulletList bullets={data.bullets.length ? data.bullets : ['']} onChange={(b) => u('bullets', b)} />
    </div>
  )
}

function ProjectForm({
  data,
  onChange,
}: {
  data: ProjectContent
  onChange: (d: ProjectContent) => void
}) {
  const u = (k: keyof ProjectContent, v: string | string[]) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Project Name" value={data.name} onChange={(v) => u('name', v)} placeholder="Pursuit" />
        <LabeledInput label="URL" value={data.url} onChange={(v) => u('url', v)} placeholder="github.com/you/project" />
      </div>
      <LabeledInput
        label="Tech Stack"
        value={data.techStack}
        onChange={(v) => u('techStack', v)}
        placeholder="React, TypeScript, PostgreSQL"
      />
      <BulletList bullets={data.bullets.length ? data.bullets : ['']} onChange={(b) => u('bullets', b)} />
    </div>
  )
}

function SkillsForm({
  data,
  onChange,
}: {
  data: SkillsContent
  onChange: (d: SkillsContent) => void
}) {
  const u = (k: keyof SkillsContent, v: string) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-2">
      <LabeledInput
        label="Category"
        value={data.category}
        onChange={(v) => u('category', v)}
        placeholder="Languages, Frameworks, Tools…"
      />
      <div>
        <label className="label mb-1 block">Items</label>
        <textarea
          className="field resize-none"
          value={data.items}
          rows={2}
          placeholder="Python, JavaScript, TypeScript, Go"
          onChange={(e) => u('items', e.target.value)}
        />
        <p className="font-mono text-[9.5px] text-ink-faint mt-1">Comma-separated. Tags will be auto-generated.</p>
      </div>
    </div>
  )
}

function EducationForm({
  data,
  onChange,
}: {
  data: EducationContent
  onChange: (d: EducationContent) => void
}) {
  const u = (k: keyof EducationContent, v: string | string[]) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="School" value={data.school} onChange={(v) => u('school', v)} placeholder="Stanford University" />
        <LabeledInput label="Degree" value={data.degree} onChange={(v) => u('degree', v)} placeholder="B.S. Computer Science" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <LabeledInput label="Start Year" value={data.startYear} onChange={(v) => u('startYear', v)} placeholder="2018" />
        <LabeledInput label="End Year" value={data.endYear} onChange={(v) => u('endYear', v)} placeholder="2022" />
        <LabeledInput label="GPA" value={data.gpa} onChange={(v) => u('gpa', v)} placeholder="3.8/4.0" />
      </div>
      <BulletList bullets={data.bullets.length ? data.bullets : ['']} onChange={(b) => u('bullets', b)} />
    </div>
  )
}

// ─── Block edit form (wraps section form + tags + actions) ────────────────────

function BlockEditForm({
  section,
  initial,
  initialTags,
  onSave,
  onCancel,
}: {
  section: string
  initial: SectionContent
  initialTags: string[]
  onSave: (content: string, tags: string[]) => void
  onCancel: () => void
}) {
  const [data, setData] = useState<SectionContent>(initial)
  const [tags, setTags] = useState<string[]>(initialTags)
  const s = section.toUpperCase()

  function save() {
    let finalTags = tags
    if (s === 'SKILLS') {
      const items = (data as SkillsContent).items
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
      finalTags = Array.from(new Set([...items, ...tags]))
    }
    onSave(serializeBlockContent(data), finalTags)
  }

  return (
    <div className="space-y-3">
      {s === 'EXPERIENCE' && (
        <ExperienceForm data={data as ExperienceContent} onChange={(d) => setData(d)} />
      )}
      {s === 'PROJECTS' && (
        <ProjectForm data={data as ProjectContent} onChange={(d) => setData(d)} />
      )}
      {s === 'SKILLS' && (
        <SkillsForm data={data as SkillsContent} onChange={(d) => setData(d)} />
      )}
      {s === 'EDUCATION' && (
        <EducationForm data={data as EducationContent} onChange={(d) => setData(d)} />
      )}
      {s !== 'SKILLS' && <TagEditor tags={tags} onChange={setTags} />}
      <div className="flex gap-2 pt-1">
        <Button variant="signal" onClick={save}>Save</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

// ─── Section-specific view cards ──────────────────────────────────────────────

function ExperienceView({ data }: { data: ExperienceContent }) {
  const dateRange = [data.startDate, data.endDate].filter(Boolean).join(' – ')
  const meta = [dateRange, data.location].filter(Boolean).join(' · ')
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-sm text-ink">
          {data.company || <span className="text-ink-faint italic font-normal">Company</span>}
        </span>
        <span className="text-sm text-ink-soft shrink-0">
          {data.role || <span className="text-ink-faint italic">Role</span>}
        </span>
      </div>
      {meta && <p className="font-mono text-[10.5px] text-ink-faint mt-0.5">{meta}</p>}
      {data.bullets.filter(Boolean).length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {data.bullets.filter(Boolean).map((b, i) => (
            <li key={i} className="text-sm text-ink flex gap-2">
              <span className="text-ink-faint shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProjectView({ data }: { data: ProjectContent }) {
  const techItems = data.techStack
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-sm text-ink">
          {data.name || <span className="text-ink-faint italic font-normal">Project name</span>}
        </span>
        {data.url && (
          <span className="font-mono text-[10px] text-ink-faint shrink-0 truncate max-w-[200px]">{data.url}</span>
        )}
      </div>
      {techItems.length > 0 && (
        <p className="font-mono text-[10.5px] text-ink-faint mt-0.5">{techItems.join(' · ')}</p>
      )}
      {data.bullets.filter(Boolean).length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {data.bullets.filter(Boolean).map((b, i) => (
            <li key={i} className="text-sm text-ink flex gap-2">
              <span className="text-ink-faint shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SkillsView({ data }: { data: SkillsContent }) {
  const items = data.items
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return (
    <div>
      {data.category && <p className="label mb-1">{data.category}</p>}
      {items.length > 0 ? (
        <p className="text-sm text-ink">{items.join(' · ')}</p>
      ) : (
        <p className="text-sm text-ink-faint italic">No items yet</p>
      )}
    </div>
  )
}

function EducationView({ data }: { data: EducationContent }) {
  const years = [data.startYear, data.endYear].filter(Boolean).join(' – ')
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-sm text-ink">
          {data.school || <span className="text-ink-faint italic font-normal">School</span>}
        </span>
        <span className="text-sm text-ink-soft shrink-0">
          {data.degree || <span className="text-ink-faint italic">Degree</span>}
        </span>
      </div>
      <div className="flex gap-4 font-mono text-[10.5px] text-ink-faint mt-0.5">
        {years && <span>{years}</span>}
        {data.gpa && <span>GPA: {data.gpa}</span>}
      </div>
      {data.bullets.filter(Boolean).length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {data.bullets.filter(Boolean).map((b, i) => (
            <li key={i} className="text-sm text-ink flex gap-2">
              <span className="text-ink-faint shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BlockViewCard({ block }: { block: ResumeBlock }) {
  const content = parseBlockContent(block.section, block.content)
  const s = block.section.toUpperCase()
  return (
    <div className="flex-1 min-w-0">
      {s === 'EXPERIENCE' && <ExperienceView data={content as ExperienceContent} />}
      {s === 'PROJECTS' && <ProjectView data={content as ProjectContent} />}
      {s === 'SKILLS' && <SkillsView data={content as SkillsContent} />}
      {s === 'EDUCATION' && <EducationView data={content as EducationContent} />}
      {block.skillTags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {block.skillTags.map((t: string) => (
            <span
              key={t}
              className="border border-line font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sortable block wrapper ───────────────────────────────────────────────────

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-paper-2 border-[1.5px] border-line p-4 flex gap-3 group"
    >
      <button
        {...listeners}
        {...attributes}
        className="text-ink-faint hover:text-ink-soft cursor-grab active:cursor-grabbing mt-0.5 shrink-0"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <div className="flex-1 min-w-0">
        {editing ? (
          <BlockEditForm
            section={block.section}
            initial={parseBlockContent(block.section, block.content)}
            initialTags={block.skillTags ?? []}
            onSave={(content, skillTags) => {
              onSave(block.id, { content, skillTags })
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <BlockViewCard block={block} />
        )}
      </div>
      {!editing && (
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:text-signal"
          >
            Edit
          </button>
          <button
            onClick={() => onArchive(block.id)}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-signal hover:text-signal-deep"
          >
            Archive
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Add block form ───────────────────────────────────────────────────────────

function AddBlockForm({
  section,
  onAdd,
}: {
  section: string
  onAdd: (data: Partial<ResumeBlock>) => void
}) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<SectionContent>(() => defaultContent(section))
  const [tags, setTags] = useState<string[]>([])
  const s = section.toUpperCase()
  const label = SECTION_LABELS[section] ?? section

  function submit() {
    let finalTags = tags
    if (s === 'SKILLS') {
      const items = (data as SkillsContent).items
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
      finalTags = Array.from(new Set([...items, ...tags]))
    }
    onAdd({ section, content: serializeBlockContent(data), skillTags: finalTags, orderDefault: 999 })
    setData(defaultContent(section))
    setTags([])
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:text-signal mt-2 inline-block"
      >
        + Add {label}
      </button>
    )
  }

  return (
    <div className="mt-3 bg-paper-3 border-[1.5px] border-line p-4 space-y-3">
      {s === 'EXPERIENCE' && (
        <ExperienceForm data={data as ExperienceContent} onChange={(d) => setData(d)} />
      )}
      {s === 'PROJECTS' && (
        <ProjectForm data={data as ProjectContent} onChange={(d) => setData(d)} />
      )}
      {s === 'SKILLS' && (
        <SkillsForm data={data as SkillsContent} onChange={(d) => setData(d)} />
      )}
      {s === 'EDUCATION' && (
        <EducationForm data={data as EducationContent} onChange={(d) => setData(d)} />
      )}
      {s !== 'SKILLS' && <TagEditor tags={tags} onChange={setTags} />}
      <div className="flex gap-2">
        <Button variant="signal" onClick={submit}>Add</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResumeEditor() {
  const qc = useQueryClient()
  const [showArchived, setShowArchived] = useState(false)

  const { data: blocks = [], isLoading } = useQuery<ResumeBlock[]>({
    queryKey: ['resume-blocks'],
    queryFn: () => api<ResumeBlock[]>('/resume/blocks'),
  })

  const { data: archivedBlocks = [] } = useQuery<ResumeBlock[]>({
    queryKey: ['resume-blocks-archived'],
    queryFn: () => api<ResumeBlock[]>('/resume/blocks?archived=true').catch(() => [] as ResumeBlock[]),
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

  function handleDragEnd(event: DragEndEvent, sectionBlocks: ResumeBlock[]) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sectionBlocks.findIndex((b) => b.id === active.id)
    const newIdx = sectionBlocks.findIndex((b) => b.id === over.id)
    const reordered = arrayMove(sectionBlocks, oldIdx, newIdx)
    reorderMutation.mutate(reordered.map((b, i) => ({ id: b.id, orderDefault: i })))
  }

  if (isLoading) return <div className="p-8 font-mono text-[11px] text-ink-faint uppercase tracking-widest">Loading resume…</div>

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Resume</h1>
        <label className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-soft cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {SECTIONS.map((section) => {
        const sectionBlocks = blocks
          .filter((b) => b.section?.toUpperCase() === section)
          .sort((a, b) => a.orderDefault - b.orderDefault)
        return (
          <div key={section}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-soft">
                {section}
              </h2>
              {sectionBlocks.length > 0 && (
                <span className="font-mono text-[10px] text-ink-faint">({sectionBlocks.length})</span>
              )}
            </div>
            {sectionBlocks.length === 0 && (
              <p className="font-mono text-[10px] text-ink-faint mb-2">
                No {SECTION_LABELS[section]?.toLowerCase()} blocks yet.
              </p>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, sectionBlocks)}
            >
              <SortableContext items={sectionBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
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
            <AddBlockForm section={section} onAdd={(data) => createMutation.mutate(data)} />
          </div>
        )
      })}

      {showArchived && archivedBlocks.length > 0 && (
        <div>
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-soft mb-3">Archived</h2>
          <div className="space-y-2 opacity-50">
            {archivedBlocks.map((block) => {
              let preview = block.content
              try {
                const c = JSON.parse(block.content)
                preview = c.company || c.name || c.school || c.category || block.content
              } catch {}
              return (
                <div
                  key={block.id}
                  className="bg-paper-2 border-[1.5px] border-line p-3 text-sm text-ink-soft"
                >
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint mr-2">
                    {block.section}
                  </span>
                  {preview}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
