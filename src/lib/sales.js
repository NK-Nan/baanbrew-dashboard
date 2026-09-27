import Papa from 'papaparse'

// ชื่อคอลัมน์ในไฟล์ CSV — ถ้าไฟล์จริงใช้ชื่ออื่น แก้ที่นี่ที่เดียว
export const COLUMNS = {
  date: 'datetime',        // วันที่ รูปแบบ YYYY-MM-DD
  billId: 'order_id',   // เลขที่บิล
  branch: 'branch',    // ชื่อสาขา
  memberId: 'customer_id', // รหัสสมาชิก (ว่างได้ถ้าไม่ใช่สมาชิก)
  amount: 'unit_price',    // ยอดเงิน (บาท)
}

export function parseCsv(input) {
  return new Promise((resolve, reject) => {
    Papa.parse(input, {
      header: true,
      skipEmptyLines: true,
      download: typeof input === 'string', // string = URL, File = ไฟล์ที่อัปโหลด
      complete: (res) => resolve(res.data),
      error: reject,
    })
  })
}

const toNumber = (v) => Number(String(v ?? '').replace(/[,฿\s]/g, '')) || 0

export function summarize(rows) {
  const c = COLUMNS
  let total = 0
  const bills = new Set()
  const members = new Set()
  const byDay = new Map()
  const byBranch = new Map()

  for (const r of rows) {
    const amount = toNumber(r[c.amount])
    const date = String(r[c.date] ?? '').slice(0, 10)
    const branch = String(r[c.branch] ?? '').trim() || 'ไม่ระบุสาขา'
    const member = String(r[c.memberId] ?? '').trim()

    total += amount
    if (r[c.billId]) bills.add(r[c.billId])
    if (member) members.add(member)
    if (date) byDay.set(date, (byDay.get(date) ?? 0) + amount)
    byBranch.set(branch, (byBranch.get(branch) ?? 0) + amount)
  }

  const billCount = bills.size
  return {
    total,
    billCount,
    avgPerBill: billCount ? total / billCount : 0,
    uniqueMembers: members.size,
    daily: [...byDay]
      .map(([date, sales]) => ({ date, sales }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    branches: [...byBranch]
      .map(([branch, sales]) => ({ branch, sales }))
      .sort((a, b) => b.sales - a.sales),
  }
}

// รูปแบบตัวเลข
const thb = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 })
export const fmtBaht = (n) => `฿${thb.format(n)}`
export const fmtBahtCompact = (n) => `฿${compact.format(n)}`
export const fmtInt = (n) => thb.format(n)
export const fmtDateShort = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
export const fmtDateLong = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
