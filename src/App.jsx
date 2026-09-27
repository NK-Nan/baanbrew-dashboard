import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  buildDashboard,
  formatNumber,
  formatThaiDate,
  getBranchOptions,
  getDateBounds,
  prepareRows,
} from './lib/metrics'
import FilterBar from './components/FilterBar'
import KpiCards from './components/KpiCards'
import DailySalesChart from './components/DailySalesChart'
import BranchSalesChart from './components/BranchSalesChart'

// ไฟล์ใน public/ เรียกได้จาก root ของเว็บ; BASE_URL รองรับกรณี deploy ใต้ path ย่อย
const CSV_URL = `${import.meta.env.BASE_URL}sales.csv`

export default function App() {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [skippedRows, setSkippedRows] = useState(0)
  const [filters, setFilters] = useState({ branch: 'all', from: '', to: '' })

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const prepared = prepareRows(result.data)
        if (prepared.length === 0) {
          setError('ไม่พบข้อมูลที่ใช้ได้ใน sales.csv ตรวจชื่อคอลัมน์และรูปแบบวันที่อีกครั้ง')
          setStatus('error')
          return
        }
        const bounds = getDateBounds(prepared)
        setRows(prepared)
        setSkippedRows(result.data.length - prepared.length)
        setFilters({ branch: 'all', from: bounds.min, to: bounds.max })
        setStatus('ready')
      },
      error: () => {
        setError('โหลด public/sales.csv ไม่สำเร็จ ตรวจว่าไฟล์อยู่ในโฟลเดอร์ public')
        setStatus('error')
      },
    })
  }, [])

  // คำนวณเฉพาะเมื่อข้อมูลหรือตัวกรองเปลี่ยน
  const branches = useMemo(() => getBranchOptions(rows), [rows])
  const bounds = useMemo(() => getDateBounds(rows), [rows])
  const data = useMemo(() => buildDashboard(rows, filters), [rows, filters])

  const defaultFilters = bounds && { branch: 'all', from: bounds.min, to: bounds.max }
  const isDefault =
    !!defaultFilters &&
    filters.branch === defaultFilters.branch &&
    filters.from === defaultFilters.from &&
    filters.to === defaultFilters.to

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 sm:mb-8">
        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">บ้านบรู Dashboard</h1>
        {status === 'ready' && (
          <p className="text-sm text-muted sm:text-base">
            {filters.branch === 'all' ? 'ทุกสาขา' : `สาขา${filters.branch}`}
            {' · '}
            {filters.from ? formatThaiDate(filters.from, { withYear: true }) : 'เริ่มต้น'} ถึง{' '}
            {filters.to ? formatThaiDate(filters.to, { withYear: true }) : 'ล่าสุด'}
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
          <FilterBar
            branches={branches}
            bounds={bounds}
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters(defaultFilters)}
            isDefault={isDefault}
          />

          {data.rowCount === 0 ? (
            <p className="rounded-xl border border-line bg-panel p-8 text-center text-muted">
              ไม่มียอดขายตามเงื่อนไขที่เลือก ลองเปลี่ยนสาขาหรือช่วงวันที่
            </p>
          ) : (
            <>
              <KpiCards data={data} />
              <DailySalesChart data={data.daily} />
              <BranchSalesChart data={data.byBranch} selected={data.selectedBranch} />
            </>
          )}

          {skippedRows > 0 && (
            <p className="text-sm text-muted">
              ข้ามแถวที่ข้อมูลไม่ครบ {formatNumber(skippedRows)} แถว
            </p>
          )}
        </div>
      )}
    </main>
  )
}
