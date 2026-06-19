import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts'

interface CostWidgetProps {
  byWeek: Array<{ week: string; costUsd: number }>
  totalThisMonth: number
}

function formatWeek(isoString: string) {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function CostWidget({ byWeek, totalThisMonth }: CostWidgetProps) {
  const data = byWeek.map((item) => ({
    label: formatWeek(item.week),
    cost: item.costUsd,
  }))

  return (
    <div className="press !shadow-hard p-5 bg-[#FBF8F0] border-1.5 border-[#1A1712] flex flex-col justify-between h-[150px]">
      <div>
        <p className="label text-[#5C5446] uppercase text-xs tracking-wider">LLM cost this month</p>
        <p className="font-display text-3xl font-black text-[#1A1712] mt-1">
          ${totalThisMonth.toFixed(4)}
        </p>
      </div>

      <div className="h-12 w-full mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Tooltip
              formatter={(val: any) => [`$${Number(val).toFixed(4)}`, 'Cost']}
              contentStyle={{
                border: '1.5px solid #1A1712',
                borderRadius: 0,
                background: '#FBF8F0',
                fontFamily: 'JetBrains Mono',
                fontSize: 10,
              }}
            />
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3A6B8E" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3A6B8E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="cost"
              stroke="#3A6B8E"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#costGrad)"
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
