import { useState } from 'react'
import { Modal, Button } from '../../components/ui'
import { useCreateApplication } from '../../lib/queries'
import { ApiError } from '../../lib/api'

const SOURCES = ['LinkedIn', 'Greenhouse', 'Referral', 'Other']

export default function AddApplicationModal({ onClose }: { onClose: () => void }) {
  const create = useCreateApplication()
  const [mode, setMode] = useState<'url' | 'text'>('url')
  const [form, setForm] = useState({
    company: '',
    roleTitle: '',
    url: '',
    rawJd: '',
    source: 'LinkedIn',
    salaryText: '',
    location: '',
    deadline: '',
  })
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await create.mutateAsync({
        company: form.company.trim(),
        roleTitle: form.roleTitle.trim(),
        url: mode === 'url' && form.url.trim() ? form.url.trim() : undefined,
        rawJd: mode === 'text' && form.rawJd.trim() ? form.rawJd.trim() : undefined,
        source: form.source || undefined,
        salaryText: form.salaryText.trim() || undefined,
        location: form.location.trim() || undefined,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create application.')
    }
  }

  return (
    <Modal title="New application" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-1.5 block">Company *</label>
            <input
              required
              autoFocus
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
              className="field"
              placeholder="Stripe"
            />
          </div>
          <div>
            <label className="label mb-1.5 block">Role title *</label>
            <input
              required
              value={form.roleTitle}
              onChange={(e) => set('roleTitle', e.target.value)}
              className="field"
              placeholder="Senior Backend Engineer"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex gap-px border-[1.5px] border-line bg-line">
            {(['url', 'text'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors ${
                  mode === m ? 'bg-ink text-paper-3' : 'bg-paper-3 text-ink-soft hover:bg-paper'
                }`}
              >
                {m === 'url' ? 'Paste URL' : 'Paste JD text'}
              </button>
            ))}
          </div>
          {mode === 'url' ? (
            <input
              type="url"
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              className="field"
              placeholder="https://jobs.example.com/123"
            />
          ) : (
            <textarea
              value={form.rawJd}
              onChange={(e) => set('rawJd', e.target.value)}
              className="field min-h-[120px] resize-y font-mono text-[12px]"
              placeholder="Paste the full job description here…"
            />
          )}
          <p className="mt-1.5 font-mono text-[10px] text-ink-faint">
            Optional. Leave blank to track manually and add the JD later.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-1.5 block">Source</label>
            <select
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
              className="field"
            >
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Location</label>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              className="field"
              placeholder="Remote / NYC"
            />
          </div>
          <div>
            <label className="label mb-1.5 block">Salary text</label>
            <input
              value={form.salaryText}
              onChange={(e) => set('salaryText', e.target.value)}
              className="field"
              placeholder="$180k–$220k"
            />
          </div>
          <div>
            <label className="label mb-1.5 block">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)}
              className="field"
            />
          </div>
        </div>

        {error && (
          <p className="border-l-2 border-missing bg-missing/10 px-3 py-2 font-mono text-[11px] text-missing">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t-[1.5px] border-line pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="signal" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Save to pipeline →'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
