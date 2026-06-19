import type { Stage } from './types'

interface StageMeta {
  code: Stage
  label: string
  // Swatch shown on column headers, badges, the funnel. Kept muted to sit on paper.
  swatch: string
}

// Ordered exactly as the pipeline flows; terminal states last.
export const STAGES: StageMeta[] = [
  { code: 'SAVED', label: 'Saved', swatch: '#8E8576' },
  { code: 'APPLIED', label: 'Applied', swatch: '#3A6B8E' },
  { code: 'OA', label: 'OA', swatch: '#6A5ACD' },
  { code: 'TECH', label: 'Tech', swatch: '#1F6B5C' },
  { code: 'HR', label: 'HR', swatch: '#9A6A1F' },
  { code: 'OFFER', label: 'Offer', swatch: '#DD4814' },
  { code: 'REJECTED', label: 'Rejected', swatch: '#9A3A2E' },
  { code: 'GHOSTED', label: 'Ghosted', swatch: '#6B6457' },
]

export const STAGE_ORDER: Stage[] = STAGES.map((s) => s.code)

// The forward funnel (excludes terminal/negative outcomes).
export const FUNNEL_STAGES: Stage[] = ['SAVED', 'APPLIED', 'OA', 'TECH', 'HR', 'OFFER']

const byCode = Object.fromEntries(STAGES.map((s) => [s.code, s])) as Record<Stage, StageMeta>

export function stageMeta(stage: Stage): StageMeta {
  return byCode[stage]
}
