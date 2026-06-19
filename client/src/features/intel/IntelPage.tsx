import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import { EmptyState, Spinner } from '../../components/ui'
import { useSkillDemand, useGapFrequency, useClusters } from '../../lib/queries'
import SkillDemandChart from './SkillDemandChart'
import GapFrequencyList from './GapFrequencyList'
import ClusterView from './ClusterView'
import DetailDrawer from '../applications/DetailDrawer'

export default function IntelPage() {
  const { data: demand, isLoading: isDemandLoading } = useSkillDemand()
  const { data: gaps, isLoading: isGapsLoading } = useGapFrequency()
  const { data: clusters, isLoading: isClustersLoading } = useClusters()

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)

  const isLoading = isDemandLoading || isGapsLoading || isClustersLoading

  const hasData = demand && demand.length > 0

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        index="05"
        title="Intelligence"
        subtitle="JD embeddings, skill demands, and similarity clusters."
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <Spinner />
        ) : !hasData ? (
          <EmptyState
            title="Not enough data yet"
            hint="Ingest at least one job description and allow the worker to run. The intelligence system will map skill demands, gaps, and clusters."
          />
        ) : (
          <div className="space-y-8">
            {/* Top Row: Skill Demand & Gaps */}
            <div className="grid gap-6 lg:grid-cols-2 items-start">
              {demand && <SkillDemandChart data={demand} />}
              {gaps && <GapFrequencyList data={gaps} />}
            </div>

            {/* Bottom Row: Clusters */}
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-black text-[#1A1712] uppercase tracking-wider">
                  Similarity Clusters
                </h3>
                <p className="text-xs text-[#5C5446] mt-0.5">
                  Applications clustered by semantic similarity of their job descriptions
                </p>
              </div>
              {clusters && <ClusterView data={clusters} onSelectApp={setSelectedAppId} />}
            </div>
          </div>
        )}
      </div>

      {selectedAppId && (
        <DetailDrawer
          id={selectedAppId}
          onClose={() => setSelectedAppId(null)}
          onSelectApp={(id) => setSelectedAppId(id)}
        />
      )}
    </div>
  )
}
