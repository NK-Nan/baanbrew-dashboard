// แถบตัวกรอง: สาขา (dropdown) + ช่วงวันที่ (ตั้งแต่ / ถึง)
// เป็น controlled component: ค่าอยู่ใน App แล้วส่งผ่าน props

const fieldClass =
  'w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink ' +
  'focus:outline-none focus:ring-2 focus:ring-leaf/40 focus:border-leaf'

function Field({ label, htmlFor, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

export default function FilterBar({ branches, bounds, filters, onChange, onReset, isDefault }) {
  const set = (patch) => onChange({ ...filters, ...patch })

  // ถ้าเลือก "ตั้งแต่" เลย "ถึง" ให้ขยับ "ถึง" ตาม (และกลับกัน) กันช่วงวันที่กลับด้าน
  const setFrom = (from) => set(from && filters.to && from > filters.to ? { from, to: from } : { from })
  const setTo = (to) => set(to && filters.from && to < filters.from ? { to, from: to } : { to })

  return (
    <section
      aria-label="ตัวกรองข้อมูล"
      className="grid grid-cols-2 items-end gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:p-5"
    >
      <div className="col-span-2 sm:col-span-1">
        <Field label="สาขา" htmlFor="filter-branch">
          <select
            id="filter-branch"
            value={filters.branch}
            onChange={(e) => set({ branch: e.target.value })}
            className={fieldClass}
          >
            <option value="all">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="ตั้งแต่วันที่" htmlFor="filter-from">
        <input
          id="filter-from"
          type="date"
          value={filters.from}
          min={bounds.min}
          max={filters.to || bounds.max}
          onChange={(e) => setFrom(e.target.value)}
          className={fieldClass}
        />
      </Field>

      <Field label="ถึงวันที่" htmlFor="filter-to">
        <input
          id="filter-to"
          type="date"
          value={filters.to}
          min={filters.from || bounds.min}
          max={bounds.max}
          onChange={(e) => setTo(e.target.value)}
          className={fieldClass}
        />
      </Field>

      <button
        type="button"
        onClick={onReset}
        disabled={isDefault}
        className="col-span-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink
                   hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-1"
      >
        ล้างตัวกรอง
      </button>
    </section>
  )
}
