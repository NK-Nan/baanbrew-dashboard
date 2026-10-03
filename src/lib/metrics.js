// src/lib/metrics.js
// รวม logic การคำนวณทั้งหมดของ Dashboard (ไม่มีโค้ด UI ในไฟล์นี้)

const TH_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/* ---------- เตรียมข้อมูล ---------- */

// แปลงค่าเป็นตัวเลข รองรับกรณีมีจุลภาคหรือช่องว่าง เช่น "1,250"
function toNumber(value) {
  if (typeof value === 'number') return value
  const n = Number(String(value ?? '').replace(/[,\s฿]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

// แปลงแถวดิบจาก PapaParse ให้พร้อมคำนวณ และตัดแถวที่ข้อมูลไม่ครบทิ้ง
export function prepareRows(rawRows) {
  return rawRows
    .map((r) => {
      const qty = toNumber(r.qty)
      const unitPrice = toNumber(r.unit_price)
      const datetime = String(r.datetime ?? '').trim()
      return {
        orderId: String(r.order_id ?? '').trim(),
        // datetime เป็นเวลาไทย (+07:00) อยู่แล้ว จึงตัด 10 ตัวแรกเป็นวันที่ได้เลย
        // ไม่แปลงผ่าน new Date() เพื่อกันวันเลื่อนเมื่อเครื่องผู้ใช้อยู่คนละ timezone
        date: datetime.slice(0, 10),
        branch: String(r.branch ?? '').trim() || 'ไม่ระบุสาขา',
        customerId: String(r.customer_id ?? '').trim(),
        productId: String(r.product_id ?? '').trim(),
        qty,
        unitPrice,
        sales: qty * unitPrice,
        // ชื่อฟิลด์ที่ Lab 2.2 (src/lab2/) ใช้ ให้ค่าเดียวกับด้านบน
        product_id: String(r.product_id ?? '').trim(),
        revenue: qty * unitPrice,
        hour: Number(datetime.slice(11, 13)),
      }
    })
    .filter(
      (r) =>
        r.orderId &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
        Number.isFinite(r.sales),
    )
}

/* ---------- KPI ---------- */

// ยอดขายรวม = ผลรวมของ qty × unit_price ทุกแถว
export function totalSales(rows) {
  return rows.reduce((sum, r) => sum + r.sales, 0)
}

// จำนวนบิล = จำนวน order_id ที่ไม่ซ้ำ (บิลเดียวมีได้หลายแถว)
export function billCount(rows) {
  return new Set(rows.map((r) => r.orderId)).size
}

// ยอดเฉลี่ยต่อบิล = ยอดขายรวม ÷ จำนวนบิล
export function averagePerBill(rows) {
  const bills = billCount(rows)
  return bills === 0 ? 0 : totalSales(rows) / bills
}

// ลูกค้าสมาชิกไม่ซ้ำ = จำนวน customer_id ที่ไม่ว่างและไม่ซ้ำกัน
export function uniqueMembers(rows) {
  return new Set(rows.map((r) => r.customerId).filter(Boolean)).size
}

/* ---------- ข้อมูลกราฟ ---------- */

// เลื่อนวันที่แบบ string 'YYYY-MM-DD' ไป 1 วัน (คำนวณใน UTC จึงไม่ติดปัญหา timezone)
function nextDate(dateKey) {
  const d = new Date(`${dateKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// ยอดขายรายวัน: รวมยอดตามวันที่ เรียงจากเก่าไปใหม่
// และเติมวันที่ไม่มียอดขายเป็น 0 เพื่อให้เส้นกราฟไม่ข้ามวัน
// start/end (ไม่บังคับ) ขยายช่วงให้ครอบคลุมวันที่ตัวกรองเลือก แม้วันนั้นจะไม่มียอดขาย
export function dailySales(rows, { start = '', end = '' } = {}) {
  const byDate = new Map()
  for (const r of rows) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.sales)
  }
  if (byDate.size === 0) return []

  const dates = [...byDate.keys()].sort()
  const first = start && start < dates[0] ? start : dates[0]
  const last = end && end > dates[dates.length - 1] ? end : dates[dates.length - 1]
  const result = []
  for (let d = first; d <= last; d = nextDate(d)) {
    result.push({ date: d, sales: byDate.get(d) ?? 0 })
  }
  return result
}

// ยอดขายรายวันในรูปแบบที่ Lab 2.2 (BadChart3) ใช้: [{ date, revenue }]
export function dailyRevenue(rows) {
  return dailySales(rows).map(({ date, sales }) => ({ date, revenue: sales }))
}

// ค่าเฉลี่ยเคลื่อนที่ย้อนหลัง N วัน (ค่าเริ่มต้น 7 วัน)
// ใช้ผลรวมแบบเลื่อนหน้าต่าง: บวกวันใหม่ ลบวันที่หลุดออกจากหน้าต่าง
// N-1 วันแรกข้อมูลยังไม่ครบ N วัน จึงให้ค่าเป็น null (กราฟจะไม่วาดช่วงนั้น)
export function addMovingAverage(daily, windowSize = 7) {
  let windowSum = 0
  return daily.map((day, i) => {
    windowSum += day.sales
    if (i >= windowSize) windowSum -= daily[i - windowSize].sales
    return {
      ...day,
      avg7: i >= windowSize - 1 ? windowSum / windowSize : null,
    }
  })
}

// ยอดขายแยกสาขา: รวมยอดตาม branch แล้วเรียงจากมากไปน้อย
export function salesByBranch(rows) {
  const byBranch = new Map()
  for (const r of rows) {
    byBranch.set(r.branch, (byBranch.get(r.branch) ?? 0) + r.sales)
  }
  return [...byBranch.entries()]
    .map(([branch, sales]) => ({ branch, sales }))
    .sort((a, b) => b.sales - a.sales)
}

/* ---------- ตัวกรอง ---------- */

// รายชื่อสาขาที่มีในข้อมูล เรียงตามตัวอักษรไทย ใช้เป็นตัวเลือกใน dropdown
export function getBranchOptions(rows) {
  return [...new Set(rows.map((r) => r.branch))].sort((a, b) => a.localeCompare(b, 'th'))
}

// วันแรกและวันสุดท้ายของข้อมูล ใช้เป็นค่าเริ่มต้นและขอบเขตของช่องวันที่
export function getDateBounds(rows) {
  if (rows.length === 0) return null
  let min = rows[0].date
  let max = rows[0].date
  for (const r of rows) {
    if (r.date < min) min = r.date
    if (r.date > max) max = r.date
  }
  return { min, max }
}

// กรองแถวตามสาขาและช่วงวันที่ (รวมวันต้นและวันท้าย)
// branch = 'all' หรือค่าว่าง คือทุกสาขา; from/to ว่าง คือไม่จำกัดด้านนั้น
// วันที่เป็น string 'YYYY-MM-DD' จึงเทียบด้วย <, > ได้ตรง ๆ
export function filterRows(rows, { branch = 'all', from = '', to = '' } = {}) {
  return rows.filter(
    (r) =>
      (branch === 'all' || !branch || r.branch === branch) &&
      (!from || r.date >= from) &&
      (!to || r.date <= to),
  )
}

// รวมทุกค่าที่ Dashboard ต้องใช้ ตามตัวกรองที่เลือก
// - KPI: จากแถวที่ผ่านทั้งตัวกรองสาขาและวันที่
// - ยอดรายวัน: คำนวณค่าเฉลี่ย 7 วันจากข้อมูลทั้งหมดของสาขานั้นก่อน แล้วค่อยตัดช่วงวันที่
//   เพื่อให้วันแรกของช่วงที่เลือกมีค่าเฉลี่ยทันที (ใช้ข้อมูล 6 วันก่อนหน้าช่วงได้)
// - ยอดแยกสาขา: กรองเฉพาะวันที่ เพื่อให้ยังเห็นทุกสาขาเทียบกัน (สาขาที่เลือกจะถูกเน้นสี)
export function buildDashboard(rows, filters = {}) {
  const { branch = 'all', from = '', to = '' } = filters
  const filtered = filterRows(rows, { branch, from, to })
  const branchRows = filterRows(rows, { branch })
  const dateRows = filterRows(rows, { from, to })

  const daily = addMovingAverage(dailySales(branchRows, { start: from, end: to }), 7).filter(
    (d) => (!from || d.date >= from) && (!to || d.date <= to),
  )

  return {
    rowCount: filtered.length,
    totalSales: totalSales(filtered),
    billCount: billCount(filtered),
    averagePerBill: averagePerBill(filtered),
    uniqueMembers: uniqueMembers(filtered),
    daily,
    byBranch: salesByBranch(dateRows),
    selectedBranch: branch,
  }
}

/* ---------- จัดรูปแบบตัวเลข ---------- */

const intFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 })
const moneyFormat = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// ฿1,234,567 (ค่าเริ่มต้นไม่มีทศนิยม) หรือ ฿1,234.50 เมื่อ decimals = true
export function formatBaht(value, { decimals = false } = {}) {
  return `฿${(decimals ? moneyFormat : intFormat).format(value)}`
}

// ตัวเลขทั่วไปพร้อมจุลภาค เช่น 12,345
export function formatNumber(value) {
  return intFormat.format(value)
}

// แบบย่อสำหรับแกนกราฟ เช่น ฿12K, ฿1.2M
export function formatBahtCompact(value) {
  if (Math.abs(value) >= 1_000_000) return `฿${+(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `฿${+(value / 1_000).toFixed(1)}K`
  return `฿${intFormat.format(value)}`
}

// แปลง 'YYYY-MM-DD' เป็นวันที่ไทย
//   year: 'none'  → '1 เม.ย.'
//   year: 'short' → '1 เม.ย. 68'   (พ.ศ. 2 หลักท้าย)
//   year: 'full'  → '1 เม.ย. 2568'
export function formatThaiDate(dateKey, { year = 'none', withYear = false } = {}) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const base = `${d} ${TH_MONTHS[m - 1]}`
  const mode = withYear ? 'full' : year // withYear คงไว้ให้โค้ดเดิมใช้ได้
  const be = y + 543
  if (mode === 'full') return `${base} ${be}`
  if (mode === 'short') return `${base} ${String(be).slice(-2)}`
  return base
}

/* ---------- ชื่อเรียกที่ไฟล์ของ Lab 2.2 ใช้ (src/lab2/FixedCharts.jsx) ---------- */

// ฿1,234,567
export const fmtBaht = (value) => formatBaht(value)

// ฿850K, ฿1.2M สำหรับแกนและป้ายบนกราฟ
export const fmtShortBaht = (value) => formatBahtCompact(value)
