import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import { buildDashboard, formatNumber, formatThaiDate } from './lib/metrics'
import KpiCards from './components/KpiCards'
import DailySalesChart from './components/DailySalesChart'
import BranchSalesChart from './components/BranchSalesChart'

// ไฟล์ใน public/ เรียกได้จาก root ของเว็บ; BASE_URL รองรับกรณี deploy ใต้ path ย่อย
const CSV_URL = `${import.meta.env.BASE_URL}sales.csv`

export default function App() {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const dashboard = buildDashboard(result.data)
        if (dashboard.rowCount === 0) {
          setError('ไม่พบข้อมูลที่ใช้ได้ใน sales.csv ตรวจชื่อคอลัมน์และรูปแบบวันที่อีกครั้ง')
          setStatus('error')
          return
        }
        setData(dashboard)
        setStatus('ready')
      },
      error: () => {
        setError('โหลด public/sales.csv ไม่สำเร็จ ตรวจว่าไฟล์อยู่ในโฟลเดอร์ public')
        setStatus('error')
      },
    })
  }, [])

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 sm:mb-8">
        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">บ้านบรู Dashboard</h1>
        {data?.dateRange && (
          <p className="text-sm text-muted sm:text-base">
            {formatThaiDate(data.dateRange.from, { withYear: true })} ถึง{' '}
            {formatThaiDate(data.dateRange.to, { withYear: true })}
          </p>
        )}
      </header>

      {status === 'loading' && <p className="text-muted">กำลังโหลดข้อมูลยอดขาย…</p>}

      {status === 'error' && (
        <p role="alert" className="rounded-xl border border-cherry/40 bg-panel p-5 text-cherry">
          {error}
        </p>
      )}

      {status === 'ready' && (
        <div className="space-y-4 sm:space-y-6">
          <KpiCards data={data} />
          <DailySalesChart data={data.daily} />
          <BranchSalesChart data={data.byBranch} />
          {data.skippedRows > 0 && (
            <p className="text-sm text-muted">
              ข้ามแถวที่ข้อมูลไม่ครบ {formatNumber(data.skippedRows)} แถว
            </p>
          )}
        </div>
      )}
    </main>
  )
}
