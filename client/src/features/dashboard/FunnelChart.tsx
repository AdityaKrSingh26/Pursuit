import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { stageMeta } from '../../lib/stages'
import type { Stage } from '../../lib/types'

const stageColors: Record<string, string> = {
  SAVED: '#A5C4D4',
  APPLIED: '#7FA8C3',
  OA: '#5A8CB2',
  TECH: '#3D719F',
  HR: '#24588C',
  OFFER: '#16A34A', // green
  REJECTED: '#D32F2F', // red
  GHOSTED: '#6B6457', // gray
}

interface FunnelChartProps {
  stageCounts: Record<Stage, number>
  conversionRates: Record<Stage, number | null>
}

export default function FunnelChart({ stageCounts, conversionRates }: FunnelChartProps) {
  const stages: Stage[] = ['SAVED', 'APPLIED', 'OA', 'TECH', 'HR', 'OFFER', 'REJECTED', 'GHOSTED']

  const data = stages.map((s) => ({
    stage: stageMeta(s)?.label || s,
    code: s,
    count: stageCounts[s] || 0,
    rate: conversionRates[s],
  }))

  const renderCustomLabel = (props: any) => {
    const { x, y, width, index } = props
    const entry = data[index]
    if (!entry || entry.rate === null || entry.rate === undefined) return null

    return (
      <text
        x={x + width / 2}
        y={y - 8}
        fill="#5C5446"
        textAnchor="middle"
        className="font-mono text-[9px] font-semibold"
      >
        {`${entry.rate}%`}
      </text>
    )
  }

  return (
    <div className="press !shadow-hard p-5 bg-[#FBF8F0] border-1.5 border-[#1A1712]">
      <p className="label mb-4 text-[#1A1712]">Stage conversion</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="#1A171214" vertical={false} />
          <XAxis
            dataKey="stage"
            tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5C5446' }}
            tickLine={false}
            axisLine={{ stroke: '#1A1712' }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5C5446' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: '#1A171210' }}
            contentStyle={{
              border: '1.5px solid #1A1712',
              borderRadius: 0,
              background: '#FBF8F0',
              fontFamily: 'JetBrains Mono',
              fontSize: 11,
            }}
          />
          <Bar dataKey="count" fill="#3A6B8E" isAnimationActive>
            {data.map((entry) => (
              <Cell
                key={entry.code}
                fill={stageColors[entry.code] || '#3A6B8E'}
                stroke="#1A1712"
                strokeWidth={1.5}
              />
            ))}
            <LabelList dataKey="count" content={renderCustomLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
