import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBaht, formatBahtCompact } from '../lib/metrics'
import useIsMobile from '../hooks/useIsMobile'

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { branch, sales } = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 text-sm shadow-sm">
      <p className="text-muted">{branch}</p>
      <p className="font-semibold">{formatBaht(sales, { decimals: true })}</p>
    </div>
  )
}

// ข้อมูลที่รับเข้ามาเรียงจากมากไปน้อยแล้ว (จาก salesByBranch)
// ใช้แท่งแนวนอน เพื่อให้ชื่อสาขาภาษาไทยยาว ๆ อ่านได้ครบ
export default function BranchSalesChart({ data }) {
  const isMobile = useIsMobile()
  const height = Math.max(200, data.length * (isMobile ? 40 : 48))

  return (
    <section className="rounded-xl border border-line bg-panel p-4 sm:p-5 lg:p-6">
      <h2 className="font-semibold">ยอดขายแยกสาขา</h2>
      <div className="mt-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: isMobile ? 56 : 72, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--color-line)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={formatBahtCompact}
              tick={{ fill: 'var(--color-muted)', fontSize: isMobile ? 11 : 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="branch"
              tick={{ fill: 'var(--color-ink)', fontSize: isMobile ? 12 : 13 }}
              tickLine={false}
              axisLine={false}
              width={isMobile ? 80 : 110}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-paper)' }} />
            <Bar dataKey="sales" fill="var(--color-leaf)" radius={[0, 4, 4, 0]} barSize={isMobile ? 20 : 24}>
              <LabelList
                dataKey="sales"
                position="right"
                formatter={(v) => (isMobile ? formatBahtCompact(v) : formatBaht(v))}
                style={{ fill: 'var(--color-ink)', fontSize: isMobile ? 11 : 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
