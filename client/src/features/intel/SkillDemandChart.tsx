import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { SkillDemandResponse } from '../../lib/types'

interface SkillDemandChartProps {
  data: SkillDemandResponse
}

export default function SkillDemandChart({ data }: SkillDemandChartProps) {
  const top20 = data.slice(0, 20)

  return (
    <div className="press !shadow-hard p-5 bg-[#FBF8F0] border-1.5 border-[#1A1712] h-full flex flex-col">
      <div className="mb-4">
        <p className="label text-[#1A1712]">Skill Demand (Top 20)</p>
        <p className="text-xs text-[#5C5446] mt-0.5">Frequency of requested skills across parsed JDs</p>
      </div>

      <div className="flex-1 min-h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={top20}
            layout="vertical"
            margin={{ top: 5, right: 20, bottom: 5, left: 30 }}
          >
            <CartesianGrid stroke="#1A171214" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5C5446' }}
              tickLine={false}
              axisLine={{ stroke: '#1A1712' }}
            />
            <YAxis
              type="category"
              dataKey="skill"
              tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#1A1712' }}
              tickLine={false}
              axisLine={{ stroke: '#1A1712' }}
              width={100}
            />
            <Tooltip
              formatter={(val: any, _name: any, props: any) => {
                const pct = props.payload.pct
                return [`${val} (${pct}% of jobs)`, 'Frequency']
              }}
              contentStyle={{
                border: '1.5px solid #1A1712',
                borderRadius: 0,
                background: '#FBF8F0',
                fontFamily: 'JetBrains Mono',
                fontSize: 11,
              }}
            />
            <Bar dataKey="count" fill="#3A6B8E" radius={0}>
              {top20.map((_, index) => (
                <Cell key={index} fill="#3A6B8E" stroke="#1A1712" strokeWidth={1.5} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
