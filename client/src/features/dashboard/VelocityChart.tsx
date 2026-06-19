import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface VelocityChartProps {
  velocity: Array<{ week: string; count: number }>
}

const INK = '#1A1712'
const SIGNAL = '#DD4814'

function formatWeek(isoString: string) {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function VelocityChart({ velocity }: VelocityChartProps) {
  const data = velocity.map((item) => ({
    label: formatWeek(item.week),
    count: item.count,
  }))

  return (
    <div className="press !shadow-hard p-5 bg-[#FBF8F0] border-1.5 border-[#1A1712]">
      <p className="label mb-4 text-[#1A1712]">Applications / week (last 8)</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="#1A171214" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5C5446' }}
            tickLine={false}
            axisLine={{ stroke: INK }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5C5446' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              border: '1.5px solid #1A1712',
              borderRadius: 0,
              background: '#FBF8F0',
              fontFamily: 'JetBrains Mono',
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            name="applications"
            stroke={SIGNAL}
            strokeWidth={2.5}
            dot={{ fill: INK, r: 3 }}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
