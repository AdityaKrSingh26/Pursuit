import {
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from './api'
import type {
  AnalysisRecord,
  Application,
  GapAnalysis,
  JdStatusResponse,
  ListApplicationsResponse,
  PrepResult,
  Stage,
  StageEvent,
  DashboardFunnelResponse,
  DashboardVelocityResponse,
  SkillDemandResponse,
  GapFrequencyResponse,
  ClusterResponse,
  SimilarJobsResponse,
  PendingRemindersResponse,
  DiscoveredJobsResponse,
  ScanStatusResponse,
} from './types'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
})

export interface AppFilters {
  stages?: Stage[]
  q?: string
  from?: string
  to?: string
}

function buildQuery(filters: AppFilters, cursor?: string): string {
  const p = new URLSearchParams()
  // The list endpoint takes a single stage; multi-select filtering for the
  // table is applied client-side after fetch (see ListPage).
  if (filters.stages?.length === 1) p.set('stage', filters.stages[0])
  if (filters.q) p.set('q', filters.q)
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  if (cursor) p.set('cursor', cursor)
  p.set('limit', '50')
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function useApplications(filters: AppFilters = {}) {
  return useQuery({
    queryKey: ['applications', filters],
    queryFn: () =>
      api<ListApplicationsResponse>('/applications' + buildQuery(filters)),
  })
}

export function useInfiniteApplications(filters: AppFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['applications-list', filters],
    queryFn: ({ pageParam }) =>
      api<ListApplicationsResponse>(
        '/applications' + buildQuery(filters, pageParam as string | undefined),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function useApplication(id: string | null) {
  return useQuery({
    queryKey: ['application', id],
    queryFn: () => api<Application>(`/applications/${id}`),
    enabled: !!id,
  })
}

export function useStageHistory(id: string | null) {
  return useQuery({
    queryKey: ['stage-history', id],
    queryFn: () => api<StageEvent[]>(`/applications/${id}/stage-history`),
    enabled: !!id,
  })
}

export interface CreateApplicationInput {
  company: string
  roleTitle: string
  url?: string
  rawJd?: string
  source?: string
  salaryText?: string
  location?: string
  deadline?: string
}

export function useCreateApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateApplicationInput) =>
      api<Application>('/applications', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  })
}

export interface PatchApplicationInput {
  stage?: Stage
  notes?: string
  nextActionAt?: string | null
  company?: string
  roleTitle?: string
  source?: string
}

export function usePatchApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchApplicationInput }) =>
      api<Application>(`/applications/${id}`, { method: 'PATCH', body: patch }),
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['application', vars.id] })
      qc.invalidateQueries({ queryKey: ['stage-history', vars.id] })
    },
  })
}

export function useDeleteApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/applications/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  })
}

export function useJdStatus(jdId: string | null, active: boolean) {
  return useQuery({
    queryKey: ['jd-status', jdId],
    queryFn: () => api<JdStatusResponse>(`/jd/${jdId}/status`),
    enabled: !!jdId && active,
    refetchInterval: (q) => {
      const status = q.state.data?.parseStatus
      return status === 'DONE' || status === 'FAILED' ? false : 2000
    },
  })
}

export function useLatestAnalysis(id: string | null, kind: 'GAP' | 'PREP') {
  return useQuery({
    queryKey: ['analysis', id, kind],
    queryFn: () =>
      api<AnalysisRecord<GapAnalysis | PrepResult>>(
        `/applications/${id}/analysis/latest?kind=${kind}`,
      ),
    enabled: !!id,
    // 404 means never run. Surface as null rather than an error banner.
    retry: false,
  })
}

export function useDashboardFunnel() {
  return useQuery({
    queryKey: ['dashboard-funnel'],
    queryFn: () => api<DashboardFunnelResponse>('/dashboard/funnel'),
  })
}

export function useDashboardVelocity() {
  return useQuery({
    queryKey: ['dashboard-velocity'],
    queryFn: () => api<DashboardVelocityResponse>('/dashboard/velocity'),
  })
}

export function useSkillDemand() {
  return useQuery({
    queryKey: ['intel-skill-demand'],
    queryFn: () => api<SkillDemandResponse>('/intel/skill-demand'),
  })
}

export function useGapFrequency() {
  return useQuery({
    queryKey: ['intel-gap-frequency'],
    queryFn: () => api<GapFrequencyResponse>('/intel/gap-frequency'),
  })
}

export function useClusters() {
  return useQuery({
    queryKey: ['intel-clusters'],
    queryFn: () => api<ClusterResponse>('/intel/clusters'),
  })
}

export function useSimilarJobs(appId: string | null) {
  return useQuery({
    queryKey: ['intel-similar', appId],
    queryFn: () => api<SimilarJobsResponse>(`/applications/${appId}/similar`),
    enabled: !!appId,
  })
}

export function usePendingReminders() {
  return useQuery({
    queryKey: ['reminders'],
    queryFn: () => api<PendingRemindersResponse>('/reminders/pending'),
  })
}

export function useDismissReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/reminders/${id}/dismiss`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
    },
  })
}

export function useDiscoveredJobs() {
  return useQuery({
    queryKey: ['discovered-jobs'],
    queryFn: () => api<DiscoveredJobsResponse>('/jobs'),
    staleTime: 60_000,
  })
}

export function useJobScanStatus() {
  return useQuery({
    queryKey: ['job-scan-status'],
    queryFn: () => api<ScanStatusResponse>('/jobs/scan-status'),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' || status === 'queued' ? 3000 : false
    },
  })
}

export function useRefreshJobs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api('/jobs/refresh', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-scan-status'] })
      qc.invalidateQueries({ queryKey: ['discovered-jobs'] })
    },
  })
}

export function useScoreJobs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api('/jobs/score', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovered-jobs'] })
    },
  })
}

