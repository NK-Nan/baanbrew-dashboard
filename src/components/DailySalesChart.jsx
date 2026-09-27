import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBaht, formatBahtCompact, formatThaiDate } from '../lib/metrics'
import useIsMobile from '../hooks/useIsMobile'

const DAILY_COLOR = 'var(--color-muted)'
const AVG_COLOR = 'var(--color-cherry)'

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { date, sales, avg7 } = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 text-sm shadow-sm">
      <p className="text-muted">{formatThaiDate(date, { withYear: true })}</p>
      {avg7 != null && (
        <p className="font-semibold text-cherry">
          เฉลี่ย 7 วัน {formatBaht(avg7, { decimals: true })}
        </p>
      )}
      <p className="text-muted">ยอดวันนี้ {formatBaht(sales, { decimals: true })}</p>
    </div>
  )
}

function LegendItem({ color, opacity = 1, thick, children }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`inline-block w-5 rounded-full ${thick ? 'h-[3px]' : 'h-[2px]'}`}
        style={{ backgroundColor: color, opacity }}
      />
      {children}
    </span>
  )
}

export default function DailySalesChart({ data }) {
  const isMobile = useIsMobile()
  const tickStyle = { fill: 'var(--color-muted)', fontSize: isMobile ? 11 : 12 }

  return (
    <section className="rounded-xl border border-line bg-panel p-4 sm:p-5 lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="font-semibold">ยอดขายรายวัน</h2>
        <div className="flex gap-4 text-xs text-muted sm:gap-5 sm:text-sm">
          <LegendItem color={AVG_COLOR} thick>ค่าเฉลี่ย 7 วัน</LegendItem>
          <LegendItem color={DAILY_COLOR} opacity={0.5}>ยอดรายวัน</LegendItem>
        </div>
      </div>
      <div className="mt-4 h-60 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: isMobile ? 4 : 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatThaiDate(d, { year: 'short' })}
              tick={tickStyle}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-line)' }}
              minTickGap={isMobile ? 16 : 28}
            />
            <YAxis
              tickFormatter={formatBahtCompact}
              tick={tickStyle}
              tickLine={false}
              axisLine={false}
              width={isMobile ? 48 : 64}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-line)' }} />
            {/* เส้นรายวัน: บาง จาง อยู่ด้านหลัง */}
            <Line
              type="linear"
              dataKey="sales"
              stroke={DAILY_COLOR}
              strokeOpacity={0.35}
              strokeWidth={1.25}
              dot={false}
              activeDot={{ r: 3, fill: DAILY_COLOR, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            {/* เส้นค่าเฉลี่ย 7 วัน: หนา สีเข้ม วาดทีหลังจึงอยู่ด้านบน */}
            <Line
              type="monotone"
              dataKey="avg7"
              stroke={AVG_COLOR}
              strokeWidth={2.75}
              dot={false}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
