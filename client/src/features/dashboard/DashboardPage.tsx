import PageHeader from '../../components/PageHeader'
import { EmptyState, Spinner } from '../../components/ui'
import { useDashboardFunnel, useDashboardVelocity } from '../../lib/queries'
import FunnelChart from './FunnelChart'
import VelocityChart from './VelocityChart'
import StatsRow from './StatsRow'
import CostWidget from './CostWidget'

export default function DashboardPage() {
  const { data: funnelData, isLoading: isFunnelLoading } = useDashboardFunnel()
  const { data: velocityData, isLoading: isVelocityLoading } = useDashboardVelocity()

  const isLoading = isFunnelLoading || isVelocityLoading

  const hasData = funnelData && funnelData.total > 0

  return (
    <div className="flex h-full flex-col">
      <PageHeader index="03" title="Funnel" subtitle="Conversion and velocity across the whole search." />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <Spinner />
        ) : !hasData ? (
          <EmptyState title="No data yet" hint="Track a few applications and the funnel fills in." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 items-start">
            {/* Left Column: Stats & Funnel */}
            <div className="space-y-6">
              <StatsRow
                total={funnelData.total}
                responseRate={funnelData.responseRate}
                ghostRate={funnelData.ghostRate}
                medianDaysApplied={funnelData.medianDaysInStage.APPLIED || 0}
              />
              <FunnelChart
                stageCounts={funnelData.stageCounts}
                conversionRates={funnelData.conversionRates}
              />
            </div>

            {/* Right Column: Cost Widget & Velocity */}
            <div className="space-y-6">
              {velocityData && (
                <>
                  <CostWidget
                    byWeek={velocityData.llmCost.byWeek}
                    totalThisMonth={velocityData.llmCost.totalThisMonth}
                  />
                  <VelocityChart velocity={velocityData.velocity} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
