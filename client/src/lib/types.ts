// Manual mirror of server Zod schemas. Synced by hand until Phase 12 adds codegen.

export type Stage =
  | 'SAVED'
  | 'APPLIED'
  | 'OA'
  | 'TECH'
  | 'HR'
  | 'OFFER'
  | 'REJECTED'
  | 'GHOSTED'

export type ParseStatus = 'QUEUED' | 'FETCHING' | 'PARSING' | 'DONE' | 'FAILED'

export interface JdStructured {
  title: string
  company: string
  location: string
  employmentType: string | null
  yoeMin: number | null
  yoeMax: number | null
  skills: string[]
  niceToHave: string[]
  responsibilities: string[]
  salaryText: string | null
  applyDeadline: string | null
}

export interface JobDescription {
  id: string
  userId: string
  sourceUrl: string | null
  rawText: string
  jdHash: string
  structured: JdStructured | null
  parseStatus: ParseStatus
  parseError: string | null
  createdAt: string
}

export interface StageEvent {
  id: string
  applicationId: string
  fromStage: Stage | null
  toStage: Stage
  at: string
}

export interface Application {
  id: string
  userId: string
  jdId: string | null
  company: string
  roleTitle: string
  source: string | null
  stage: Stage
  nextActionAt: string | null
  notes: string | null
  createdAt: string
  stageEvents: StageEvent[]
  jd: JobDescription | null
}

export interface ListApplicationsResponse {
  items: Application[]
  nextCursor: string | null
}

export interface JdStatusResponse {
  id: string
  parseStatus: ParseStatus
  parseError: string | null
  structured: JdStructured | null
}

export interface GapAnalysis {
  matchedSkills: string[]
  missingSkills: string[]
  partialSkills: string[]
  bulletRanking: Array<{ blockId: string; relevanceScore: number; reason: string }>
  riskQuestions: string[]
  overallSummary: string
  llmRelevanceScore: number
  matchScore: number
  skillOverlapPct: number
}

export interface PrepQuestion {
  text: string
  reason: string
}

export interface PrepResult {
  technicalQuestions: PrepQuestion[]
  behavioralQuestions: PrepQuestion[]
  gapProbes: PrepQuestion[]
  companyAngle: string
}

export interface AnalysisRecord<T = GapAnalysis | PrepResult> {
  id: string
  applicationId: string
  kind: 'GAP' | 'PREP' | 'TAILOR'
  resumeVersionId: string | null
  jdHash: string
  result: T
  tokensIn: number
  tokensOut: number
  costUsd: string
  createdAt: string
}

export interface AuthUser {
  id: string
  email: string
}

// SSE event union emitted by the analysis routes.
export type SSEEvent<T> =
  | { type: 'token'; content: string }
  | { type: 'result'; data: T }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface ResumeBlock {
  id: string
  userId: string
  section: string
  content: string
  skillTags: string[]
  orderDefault: number
  archivedAt: string | null
}

export type ExperienceContent = {
  company: string
  role: string
  startDate: string
  endDate: string
  location: string
  bullets: string[]
}

export type ProjectContent = {
  name: string
  url: string
  techStack: string
  bullets: string[]
}

export type SkillsContent = {
  category: string
  items: string
}

export type EducationContent = {
  school: string
  degree: string
  startYear: string
  endYear: string
  gpa: string
  bullets: string[]
}

export type SectionContent = ExperienceContent | ProjectContent | SkillsContent | EducationContent

export function defaultContent(section: string): SectionContent {
  switch (section.toUpperCase()) {
    case 'EXPERIENCE':
      return { company: '', role: '', startDate: '', endDate: 'Present', location: '', bullets: [''] }
    case 'PROJECTS':
      return { name: '', url: '', techStack: '', bullets: [''] }
    case 'SKILLS':
      return { category: '', items: '' }
    case 'EDUCATION':
      return { school: '', degree: '', startYear: '', endYear: '', gpa: '', bullets: [''] }
    default:
      return { category: '', items: '' }
  }
}

export function parseBlockContent(section: string, raw: string): SectionContent {
  try {
    return JSON.parse(raw) as SectionContent
  } catch {
    switch (section.toUpperCase()) {
      case 'EXPERIENCE':
        return { company: '', role: '', startDate: '', endDate: '', location: '', bullets: raw ? [raw] : [''] }
      case 'PROJECTS':
        return { name: '', url: '', techStack: '', bullets: raw ? [raw] : [''] }
      case 'SKILLS':
        return { category: '', items: raw }
      case 'EDUCATION':
        return { school: '', degree: '', startYear: '', endYear: '', gpa: '', bullets: raw ? [raw] : [''] }
      default:
        return { category: '', items: raw }
    }
  }
}

export function serializeBlockContent(data: SectionContent): string {
  return JSON.stringify(data)
}

export interface TailoringProposal {
  blockId: string
  action: 'include' | 'exclude' | 'rewrite'
  rewrittenContent: string | null
  reason: string
  originalContent?: string
}

export interface TailoringResult {
  proposals: TailoringProposal[]
}

export interface DashboardFunnelResponse {
  stageCounts: Record<Stage, number>
  conversionRates: Record<Stage, number | null>
  ghostRate: number
  responseRate: number
  total: number
  medianDaysInStage: Record<Stage, number>
}

export interface DashboardVelocityResponse {
  velocity: Array<{ week: string; count: number }>
  llmCost: {
    byWeek: Array<{ week: string; costUsd: number }>
    totalThisMonth: number
  }
}

export interface SkillDemandResponseItem {
  skill: string
  count: number
  pct: number
}
export type SkillDemandResponse = SkillDemandResponseItem[]

export interface GapFrequencyResponseItem {
  skill: string
  missingCount: number
  demandPct: number
}
export type GapFrequencyResponse = GapFrequencyResponseItem[]

export interface ClusterResponseItem {
  label: string
  skills: string[]
  jobIds: string[]
  size: number
  applications: Array<{
    id: string
    company: string
    roleTitle: string
  }>
}
export type ClusterResponse = ClusterResponseItem[]

export interface SimilarJobsResponseItem {
  id: string
  company: string
  roleTitle: string
  similarity: number
}
export type SimilarJobsResponse = SimilarJobsResponseItem[]

export interface Reminder {
  id: string
  windowKey: string
  draftEmail: string | null
  createdAt: string
  daysSince: number
  application: {
    company: string
    roleTitle: string
    stage: Stage
  }
}
export type PendingRemindersResponse = Reminder[]

export interface DiscoveredJob {
  id: string
  company: string
  title: string
  url: string
  location: string | null
  fetchedAt: string
  score: number | null
  scoreReason: string | null
  techStack: string[]
  scoredAt: string | null
}

export interface DiscoveredJobsResponse {
  jobs: DiscoveredJob[]
  lastScanAt: string | null
  total: number
}

export interface ScanStatusResponse {
  status: 'idle' | 'queued' | 'running'
  progress: number
  lastScanAt: string | null
}


