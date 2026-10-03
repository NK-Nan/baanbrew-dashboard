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
import Tabs from './components/Tabs'
import FilterBar from './components/FilterBar'
import KpiCards from './components/KpiCards'
import DailySalesChart from './components/DailySalesChart'
import BranchSalesChart from './components/BranchSalesChart'
import Lab2Page from './lab2/Lab2Page.jsx'

// ไฟล์ใน public/ เรียกได้จาก root ของเว็บ; BASE_URL รองรับกรณี deploy ใต้ path ย่อย
const BASE = import.meta.env.BASE_URL
const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'lab2', label: 'Lab 2.2 · ซ่อมกราฟแย่' },
]

// อ่าน CSV เป็น Promise (ทุกคอลัมน์เป็นข้อความ ตัดช่องว่างที่หัวคอลัมน์)
function loadCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(`${BASE}${file}`, {
      download: true,
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
      complete: (result) => resolve(result.data),
      error: reject,
    })
  })
}

// แท็บอ่านจาก #hash เพื่อให้รีเฟรชแล้วอยู่แท็บเดิม และลิงก์ #case-3 ของ Lab 2.2 เปิดแท็บ Lab ให้เอง
function tabFromHash() {
  const h = window.location.hash.slice(1)
  return h === 'lab2' || h.startsWith('case-') ? 'lab2' : 'dashboard'
}

export default function App() {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [productsMissing, setProductsMissing] = useState(false)
  const [skippedRows, setSkippedRows] = useState(0)
  const [filters, setFilters] = useState({ branch: 'all', from: '', to: '' })
  const [tab, setTab] = useState(tabFromHash)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const changeTab = (id) => {
    setTab(id)
    window.history.replaceState(null, '', id === 'dashboard' ? window.location.pathname : `#${id}`)
  }

  useEffect(() => {
    const salesP = loadCsv('sales.csv')
    // products.csv ใช้แค่ชื่อเมนูใน Lab 2.2 ถ้าไม่มีไฟล์ยังทำงานได้ (แสดงเป็นรหัสสินค้าแทน)
    const productsP = loadCsv('products.csv').catch(() => null)

    Promise.all([salesP, productsP])
      .then(([salesRaw, productsRaw]) => {
        const prepared = prepareRows(salesRaw)
        if (prepared.length === 0) {
          setError('ไม่พบข้อมูลที่ใช้ได้ใน sales.csv ตรวจชื่อคอลัมน์และรูปแบบวันที่อีกครั้ง')
          setStatus('error')
          return
        }
        const bounds = getDateBounds(prepared)
        const validProducts = (productsRaw ?? []).filter((p) => p.product_id && p.product_name)
        setRows(prepared)
        setSkippedRows(salesRaw.length - prepared.length)
        setProducts(validProducts)
        setProductsMissing(validProducts.length === 0)
        setFilters({ branch: 'all', from: bounds.min, to: bounds.max })
        setStatus('ready')
      })
      .catch(() => {
        setError('โหลด public/sales.csv ไม่สำเร็จ ตรวจว่าไฟล์อยู่ในโฟลเดอร์ public')
        setStatus('error')
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
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">บ้านบรู Dashboard</h1>
        {status === 'ready' && tab === 'dashboard' && (
          <p className="text-sm text-muted sm:text-base">
            {filters.branch === 'all' ? 'ทุกสาขา' : `สาขา${filters.branch}`}
            {' · '}
            {filters.from ? formatThaiDate(filters.from, { withYear: true }) : 'เริ่มต้น'} ถึง{' '}
            {filters.to ? formatThaiDate(filters.to, { withYear: true }) : 'ล่าสุด'}
          </p>
        )}
      </header>

      <Tabs tabs={TABS} active={tab} onChange={changeTab} />

      {status === 'loading' && <p className="text-muted">กำลังโหลดข้อมูลยอดขาย…</p>}

      {status === 'error' && (
        <p role="alert" className="rounded-xl border border-cherry/40 bg-panel p-5 text-cherry">
          {error}
        </p>
      )}

      {status === 'ready' && tab === 'dashboard' && (
        <div id="panel-dashboard" role="tabpanel" aria-labelledby="tab-dashboard"
             className="space-y-4 sm:space-y-6">
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

      {status === 'ready' && tab === 'lab2' && (
        <div id="panel-lab2" role="tabpanel" aria-labelledby="tab-lab2">
          {productsMissing && (
            <p className="mb-4 rounded-lg border border-line bg-panel p-3 text-sm text-muted">
              ไม่พบ public/products.csv กราฟเมนูจะแสดงเป็นรหัสสินค้าแทนชื่อเมนู
            </p>
          )}
          {/* Lab 2.2 ใช้ข้อมูลทั้งหมด ไม่ผ่านตัวกรองของ Dashboard */}
          <Lab2Page rows={rows} products={products} />
        </div>
      )}
    </main>
  )
}
